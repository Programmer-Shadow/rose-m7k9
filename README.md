# LMX 粒子玫瑰

一个基于 Three.js 的 3D 粒子玫瑰静态 H5 礼物页面，适合部署到 GitHub Pages 后在微信里打开。玫瑰点云、花心、茎叶都在 WebGL 空间中渲染，拖动可以旋转。

## 本地预览

在当前目录运行：

```powershell
D:\Anaconda\envs\stylegan3\python.exe -m http.server 4173
```

然后打开 `http://127.0.0.1:4173`。

## GitHub Pages 发布

1. 在 GitHub 新建一个公开仓库，例如 `lmx-particle-rose`。
2. 把本目录中的 `index.html`、`styles.css`、`app.js`、`README.md` 上传到仓库根目录。
3. 打开仓库的 **Settings → Pages**。
4. 在 **Build and deployment** 中选择 **Deploy from a branch**，分支选 `main`，目录选 `/ (root)`，点击保存。
5. 等待一两分钟，GitHub 会生成 `https://你的用户名.github.io/lmx-particle-rose/`。

微信内首次触摸会点亮玫瑰并尝试开启原创纯音乐；如果微信没有自动放音，点击“播放音乐”即可。`three.min.js` 已经随项目本地提供，不依赖 CDN。

## 文件说明

- `index.html`：页面结构和礼物文案。
- `styles.css`：夜幕、排版和移动端布局。
- `app.js`：3D 粒子生成、旋转/绽放/爱心交互和原创 Web Audio 音乐。
- `three.min.js`：Three.js 0.149.0，MIT License。
