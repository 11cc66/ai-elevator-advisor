import Link from "next/link";
import { redirect } from "next/navigation";

import { loadActor } from "@/modules/access/actor";
import { PERMISSIONS } from "@/modules/access/permissions";
import { hasPermissionInAnyScope } from "@/modules/access/policy";
import { requirePageSession } from "@/modules/auth/page-session";
import { listCatalogProducts } from "@/modules/mvp/store";
import {
  BUSINESS_SCENARIO_CODES,
  getScenarioPresentation,
} from "@/modules/workbench/presentation";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; scenario?: string }>;
}) {
  const session = await requirePageSession("/catalog");
  const actor = await loadActor(session.user.id);
  if (!hasPermissionInAnyScope(actor, PERMISSIONS.CATALOG_READ)) {
    redirect("/admin/forbidden");
  }
  const filters = await searchParams;
  const query = filters.q?.trim().toLowerCase() ?? "";
  const scenario = filters.scenario ?? "";
  const products = (await listCatalogProducts()).filter((product) => {
    const classificationAllowed =
      product.verificationStatus === "DEMO_MOCK" ||
      product.verificationStatus === "VERIFIED";
    const haystack =
      `${product.manufacturer} ${product.brand} ${product.modelCode} ${product.name}`
        .toLowerCase();
    const queryMatches = query.length === 0 || haystack.includes(query);
    const scenarioMatches =
      scenario.length === 0 ||
      product.applicableScenarios.some((item) => item === scenario);
    return classificationAllowed && queryMatches && scenarioMatches;
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Link className="text-sm text-cyan-800" href="/">← 返回首页</Link>
      <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-cyan-800">产品知识库</p>
        <h1 className="mt-2 text-3xl font-semibold">电梯产品目录</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          仅展示 DEMO_MOCK 或已审核数据。参数与价格仍需销售、技术审核和正式询价确认。
        </p>
        <form className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_auto]" method="get">
          <label className="text-sm font-medium">
            品牌或型号
            <input
              className="admin-input mt-1"
              defaultValue={query}
              name="q"
              placeholder="输入厂商、品牌或型号"
            />
          </label>
          <label className="text-sm font-medium">
            适用场景
            <select className="admin-input mt-1" defaultValue={scenario} name="scenario">
              <option value="">全部场景</option>
              {BUSINESS_SCENARIO_CODES.map((value) => (
                <option key={value} value={value}>
                  {getScenarioPresentation(value).label}
                </option>
              ))}
            </select>
          </label>
          <button className="admin-button self-end" type="submit">筛选</button>
        </form>
      </header>

      {products.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-slate-500">
          当前筛选条件下没有可展示产品。
        </p>
      ) : (
        <section className="mt-6 grid gap-5 md:grid-cols-2">
          {products.map((product) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-6"
              key={product.productId}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">
                    {product.manufacturer} / {product.brand}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {product.modelCode} · {product.name}
                  </h2>
                </div>
                <span className="demo-badge">{product.verificationStatus}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">载重</dt><dd>{product.specification.capacityKg ?? "待确认"} kg</dd></div>
                <div><dt className="text-slate-500">速度</dt><dd>{product.specification.speedMps ?? "待确认"} m/s</dd></div>
                <div><dt className="text-slate-500">最大层数</dt><dd>{product.specification.maxFloors ?? "待确认"}</dd></div>
                <div><dt className="text-slate-500">最大行程</dt><dd>{product.specification.maxTravelM ?? "待确认"} m</dd></div>
              </dl>
              <p className="mt-4 text-sm text-slate-600">
                适用场景：
                {product.applicableScenarios
                  .map((item) => getScenarioPresentation(item).label)
                  .join("、")}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                参考价格：{product.price?.minimumAmount
                  ? `¥${product.price.minimumAmount.toLocaleString("zh-CN")} 起`
                  : "待询价"}
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                来源：{product.sourceReferences.join("；") || "待补充"} · 参数版本 v{product.specificationVersion}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
