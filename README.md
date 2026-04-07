<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c65537ad-4e8e-456e-a624-2ffbf7559e7c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. **AI**：纯 mock 可设 `GEMINI_API_KEY`（见 [.env.local](.env.local)）；联调自建后端时请在 `backend/.env` 配置豆包/方舟（`ARK_API_KEY`、`DOUBAO_ENDPOINT_ID` 等），说明见 **[backend/README.md](backend/README.md)**（文中「豆包 / 火山方舟 AI 配置」一节）。
3. Run the app:
   `npm run dev`
