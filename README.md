# 轻压 · 文件压缩与格式转换

无需安装的浏览器工具。文件在本机处理，不上传至服务器。

## 功能

- 图片、DOCX、PDF 压缩，默认目标 200KB
- JPG、PNG、WebP 互转，图片转 PDF
- PDF 转 JPG / PNG，每页分别下载
- DOCX / 文字版 PDF 提取 TXT
- 转换后接着压缩，逐个显示是否达标
- 单文件离线使用，依赖与 PDF 字体资源已内置

## 使用

访问本仓库的 GitHub Pages 网站，或下载“轻压-免安装完整版.html”后用新版 Chrome、Edge 或 Firefox 打开。

## GitHub Pages 发布

进入仓库 Settings → Pages，在 Build and deployment 中选择 Deploy from a branch，分支选择 main，目录选择 /docs，然后保存。

## 修改与构建

src/ 保存源码，vendor/ 保存第三方组件，pdfjs/ 保存字符映射和字体。修改 src/ 后，在项目目录运行：

```
node build-offline.cjs
```

随后将生成的“轻压-免安装完整版.html”复制到 docs/index.html，即可更新在线版本。运行成品不需要 Node.js。

## 限制

复杂文件不保证达到目标大小。PDF 压缩会转成图片页面，文字搜索、链接、表单不保留。TXT 保留完整文本，不为缩小大小而截断。扫描件文字提取需要 OCR，暂不提供。旧版 DOC、Word 与 PDF 互转暂不提供。批量下载可能需要浏览器允许多个文件下载。

已通过脚本语法与依赖内置检查，尚未完成浏览器端完整文件转换验证。

## 第三方组件

JSZip 3.10.1：MIT（可选）；pdf-lib 1.17.1：MIT；PDF.js 4.10.38：Apache-2.0。许可证保留于相应组件及 pdfjs/LICENSE。

## 仓库版依赖与离线构建

仓库包含可编辑源码和可直接部署的 docs/ 网页。初始 docs/ 使用固定版本 CDN 依赖，需要联网。运行以下命令会生成内置全部依赖和字体的离线完整版，并同时更新 docs/index.html 为离线版本：

```
npm install
npm run build
```

构建需要 Node.js 22 或更新版本。依赖版本在 package.json 中固定。无需构建即可使用本聊天已交付的离线 HTML。
