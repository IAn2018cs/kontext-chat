# 使用一个合适的 Node.js 版本
FROM node:lts-slim

# 安装 CA 证书和其他必要的工具
RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 安装 wrangler
# RUN npm install -g wrangler@latest # 使用最新版或者一个特定版本
RUN npm install -g wrangler

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json (如果存在)
# 确保 package-lock.json 存在以获得可复现的构建
COPY package*.json ./


# 安装项目依赖 (both production and dev, as wrangler dev might need dev deps)
RUN npm install

# 复制项目所有剩余文件
# This ensures all source code, wrangler.jsonc, tsconfig.json, etc., are available
COPY . .


# Cloudflare Workers 默认端口是 8787
EXPOSE 8787

ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# 启动应用的命令
# --port 可以用来改变端口，但如果 wrangler.jsonc 中有配置，可能会覆盖
# 我们将使用默认的 8787 端口
CMD ["wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]