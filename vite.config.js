import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// base نسبي ليعمل البناء على GitHub Pages (مسار فرعي) وعلى أي استضافة
export default defineConfig({ base: "./", plugins: [react()] });
