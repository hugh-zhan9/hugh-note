
minio 文件存储

```yaml
version: "3"
services:
  minio:
    image: bitnami/minio:2025
    # image: ccr.ccs.tencentyun.com/k7scn/minio:2025
    container_name: minio
    restart: always
    environment:
      - MINIO_ROOT_USER=homes4
      - MINIO_ROOT_PASSWORD=aiy0ooCheephai0ohNahmu3Aijee6eiv
      - MINIO_DEFAULT_BUCKETS=homes4
    ports:
      - '9000:9000'
      - '9001:9001'
    volumes:
      - '/volume1/docker/minio/data:/bitnami/minio/data'


```


caddy

```yaml
services:
  caddy:
    image: ysicing/caddy2
    # image: ccr.ccs.tencentyun.com/k7scn/caddy2
    container_name: caddy
    restart: always
    # 可选host或者端口映射
    network_mode: host
    volumes:
      - '/data/caddy/cfg:/etc/caddy'
      - '/data/caddy/data:/data'
      - '/data/caddy/config:/config'
      - '/data/caddy/log:/var/log/caddy'
```


此 Caddy 镜像为我的定制版，内置以下常用插件：

```bash
xcaddy build \
    --with github.com/caddy-dns/cloudflare \
    --with github.com/caddy-dns/tencentcloud \
    --with github.com/caddy-dns/alidns \
    --with github.com/caddy-dns/dnspod \
    --with github.com/ysicing/caddy2-geocn \
    --with github.com/mholt/caddy-l4 \
    --with github.com/mholt/caddy-ratelimit
```

#### Caddy 配置

配置文件位于 `/data/caddy/cfg`，目录结构如下：

```bash
/data/caddy/cfg# tree
.
├── Caddyfile
├── load.sh
└── site
    ├── cr.caddy
    ├── dev.caddy
    ├── hub.caddy
    ├── http.caddy
    └── minio.caddy
```

#### Caddyfile 示例

```bash
(LOG) {
	log {
		output file "{args[0]}" {
			roll_size 50M
			roll_uncompressed
			roll_local_time
			roll_keep 3
			roll_keep_for 7d
		}
		format json
	}
}

(COMCFG) {
	encode zstd gzip
}

(ERR) {
	handle_errors {
    	# 异常重定向
		redir https://dxgw-{err.status_code}.caddy.local
	}
}

{
	debug
	# admin off
}

(TLS) {
tls {
  dns tencentcloud {
    secret_id AKID***
    secret_key CH85***
  }
}
}

import /etc/caddy/site/*.caddy
复制
```

#### MinIO 配置

> minio.caddy

```bash
域名 {
	import ERR
    # 如果是内网域名可以设置import TLS开启dns签发证书
    # import TLS
    import LOG "/var/log/caddy/minio.log"
	@rootPath {
		path /
	}
	handle @rootPath {
		respond "EdgeONE 451 Forbidden" 451
	}
    # 内网minio地址
    reverse_proxy 100.90.80.2:9000
}
```

同理，minio 控制台也是一样，通常控制台不对外开放，仅限内网访问。

> minio-api.caddy

```kotlin
域名 {
	import ERR
    # 如果是内网域名可以设置import TLS开启dns签发证书
    # import TLS
    import LOG "/var/log/caddy/minio-api.log"
    @denied not remote_ip 192.168.1.0/24
    respond @denied "Access Denied" 403
    # 内网minio api地址
    reverse_proxy 100.90.80.2:9001
}
```

#### 重新加载配置

```bash
curl "http://localhost:2019/load" -H "Content-Type: text/caddyfile" --data-binary @Caddyfile
```

### 使用 MinIO

> 配置 MinIO 客户端（mc）以访问服务：

```bash
# 内网
mc alias set home http://100.90.80.2:9000 homes4 aiy0ooCheephai0ohNahmu3Aijee6eiv
# 外网
mc alias set home https://域名 homes4 aiy0ooCheephai0ohNahmu3Aijee6eiv
```

更多场景可结合 [restic](https://blog.ysicing.net/backup-restic)，rclone，[下载服务](https://blog.ysicing.net/docker-aria2-pro)等


## Alist

```yaml
services:
  alist:
    image: xhofe/alist:main-aio
    # image: ccr.ccs.tencentyun.com/k7scn/alist:main-aio
    container_name: alist
    ports:
      - "5244:5244"
    volumes:
      - /data/alist:/opt/alist/data # 应用程序持久化数据
      - /data/share:/opt/share # 本地存储，可选
    environment:
      - TZ=Asia/Shanghai
      - ALIST_ADMIN_PASSWORD=goxee7dieXeihu9uochoo6iquaighail
    restart: always
```

`ALIST_ADMIN_PASSWORD` 支持自定义密码

### 启动容器

```bash
docker compose up -d
```

### 配置 caddy

caddy 配置比较简单

```
alist.ysicing.eu.org {  reverse_proxy 100.90.80.2:5244}
```

### 访问 alist

访问 Alist：在浏览器输入 `http://你的服务器IP:5244` 或者 `caddy域名`，进入 Alist 界面。

默认用户名是 `admin`, 密码是你配置的 `ALIST_ADMIN_PASSWORD` 值信息

## 挂载 MinIO 存储

登录 Alist，点击 **管理** > **存储** >  **添加** 。

选择存储类型为**对象存储**

![](https://global.12306.work/2025/20250507/alist-minio/02.png)

填写以下信息：

* 挂载路径：自定义，例如 /minio。
* Endpoint：[http://minio](http://minio/) 域名地址:9000。
* Bucket：填写你在 MinIO 创建的存储桶名称，例如 ja。
* Access Key 和 Secret Key：填入 MinIO 控制台生成的密钥。
* 强制路径样式：默认勾选
* 地区：默认留空

![](https://global.12306.work/2025/20250507/alist-minio/03.png)

保存配置后，返回 Alist 主页，即可看到挂载的 MinIO 存储

![](https://global.12306.work/2025/20250507/alist-minio/04.png)

可以上面的操作后就可以通过 Alist 浏览、分享 MinIO 中的文件，支持在线预览、下载等功能。

![](https://global.12306.work/2025/20250507/alist-minio/05.png)
