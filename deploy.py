#!/usr/bin/env python3
"""会员管理系统腾讯云部署脚本"""
import paramiko
import os
import time

HOST = "110.40.212.84"
PORT = 22
USER = "root"
PWD = "Wdl123456789"

LOCAL_DIR = r"D:\workbuddy腾讯小龙虾\Claw\member-system"
REMOTE_DIR = "/opt/member-system"

def run_cmd(ssh, cmd, desc=""):
    print(f"\n>>> {desc}: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out.strip())
    if err: print(f"[ERR] {err.strip()}")
    return out.strip(), err.strip()

def upload_file(sftp, local_path, remote_path):
    print(f"  上传: {local_path} -> {remote_path}")
    sftp.put(local_path, remote_path)

def main():
    print("=" * 60)
    print("  行馆旅居 - 会员管理系统 腾讯云部署")
    print(f"  目标: {USER}@{HOST}:{PORT}")
    print("=" * 60)

    # 连接
    print("\n[1/6] 连接服务器...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, PORT, USER, PWD, timeout=30)
    sftp = ssh.open_sftp()
    print("  连接成功!")

    # 创建目录
    print("\n[2/6] 创建目录...")
    run_cmd(ssh, f"mkdir -p {REMOTE_DIR}/db {REMOTE_DIR}/public", "创建项目目录")

    # 上传代码
    print("\n[3/6] 上传代码...")
    upload_file(sftp, f"{LOCAL_DIR}/server.js", f"{REMOTE_DIR}/server.js")
    upload_file(sftp, f"{LOCAL_DIR}/package.json", f"{REMOTE_DIR}/package.json")
    upload_file(sftp, f"{LOCAL_DIR}/public/index.html", f"{REMOTE_DIR}/public/index.html")
    upload_file(sftp, f"{LOCAL_DIR}/db/xingguan.json", f"{REMOTE_DIR}/db/xingguan.json")
    sftp.close()

    # 检查/安装 Node.js
    print("\n[4/6] 检查 Node.js...")
    out, _ = run_cmd(ssh, "node --version 2>/dev/null || echo 'not_installed'")
    if "not_installed" in out:
        print("  安装 Node.js 22.x...")
        run_cmd(ssh, "curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -", "安装NodeSource")
        run_cmd(ssh, "yum install -y nodejs", "安装Node.js")
    out, _ = run_cmd(ssh, "node --version")
    print(f"  Node.js版本: {out}")

    # 安装依赖
    print("\n[5/6] 安装项目依赖...")
    run_cmd(ssh, f"cd {REMOTE_DIR} && npm install --production", "npm install")

    # 配置防火墙
    print("\n[6/6] 配置防火墙...")
    # 先检查防火墙类型
    out, _ = run_cmd(ssh, "which firewall-cmd 2>/dev/null && echo 'firewalld' || echo 'not_firewalld'")
    if "firewalld" in out:
        run_cmd(ssh, "firewall-cmd --permanent --add-port=3456/tcp 2>/dev/null; firewall-cmd --reload 2>/dev/null", "开放端口3456")
    out, _ = run_cmd(ssh, "which iptables 2>/dev/null && echo 'iptables' || echo 'no_iptables'")
    if "iptables" in out:
        run_cmd(ssh, "iptables -I INPUT -p tcp --dport 3456 -j ACCEPT 2>/dev/null", "iptables开放端口")
    
    # 检查腾讯云安全组
    print("\n  ⚠️ 请确认腾讯云安全组已开放3456端口:")
    print("    控制台 -> 云服务器 -> 安全组 -> 添加规则")
    print("    协议:TCP  端口:3456  来源:0.0.0.0/0")

    # 停止旧进程
    run_cmd(ssh, "pkill -f 'node server.js' 2>/dev/null; sleep 1", "停止旧进程")

    # 启动服务
    print("\n启动服务...")
    run_cmd(ssh, f"cd {REMOTE_DIR} && nohup node server.js > /var/log/member-system.log 2>&1 & echo PID: $!", "启动")

    time.sleep(2)

    # 验证
    print("\n验证服务...")
    out, _ = run_cmd(ssh, "curl -s http://localhost:3456/ | head -c 100")
    if "html" in out.lower() or "<!DOCTYPE" in out.upper():
        print("  ✅ 服务启动成功!")
    else:
        out2, _ = run_cmd(ssh, "ps aux | grep 'node server' | grep -v grep")
        if out2:
            print("  ✅ 进程运行中")
        else:
            print("  ❌ 服务未启动，检查日志:")
            run_cmd(ssh, "cat /var/log/member-system.log")

    ssh.close()

    print("\n" + "=" * 60)
    print(f"  🎉 部署完成!")
    print(f"  🌐 访问地址: http://{HOST}:3456")
    print(f"  🔑 登录账号: admin / xg2026")
    print("=" * 60)

if __name__ == "__main__":
    main()
