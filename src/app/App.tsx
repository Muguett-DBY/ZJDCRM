import { appDescription, appName } from "./meta";

export function App() {
  return (
    <main className="product-shell">
      <section className="product-card" aria-labelledby="product-title">
        <p className="product-eyebrow">Cloudflare CRM</p>
        <h1 id="product-title">{appName}</h1>
        <p>{appDescription}</p>
        <span>应用基础设施已就绪，业务模块即将上线。</span>
      </section>
    </main>
  );
}
