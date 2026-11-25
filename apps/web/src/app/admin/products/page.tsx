import { PERMISSIONS } from "@/modules/access/permissions";
import { requireAdminPermission } from "@/modules/auth/page-session";
import { listCatalogProducts } from "@/modules/mvp/store";

import { ProductForm } from "./product-form";
import { SeedDemoButton } from "./seed-demo-button";

export const dynamic = "force-dynamic";

export default async function ProductsAdminPage() {
  await requireAdminPermission(PERMISSIONS.CATALOG_MANAGE);
  const products = await listCatalogProducts();
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-cyan-800">管理后台</p>
        <h1 className="mt-1 text-3xl font-semibold">电梯产品目录</h1>
        <p className="mt-2 text-slate-600">
          当前仅允许录入和展示 DEMO_MOCK 演示产品。
        </p>
      </header>
      <SeedDemoButton />
      <ProductForm />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {products.length === 0 ? (
          <p className="p-6 text-slate-500">目录为空，可先新增 DEMO_MOCK 产品。</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr><th className="px-4 py-3">厂商 / 品牌</th><th className="px-4 py-3">型号</th><th className="px-4 py-3">载重 / 速度</th><th className="px-4 py-3">层数</th><th className="px-4 py-3">价格</th><th className="px-4 py-3">状态</th></tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr className="border-t border-slate-100" key={product.specificationId}>
                  <td className="px-4 py-3">{product.manufacturer} / {product.brand}</td>
                  <td className="px-4 py-3"><a className="text-cyan-800" href={`/admin/products/${product.productId}`}>{product.modelCode}</a></td>
                  <td className="px-4 py-3">{product.specification.capacityKg ?? "未知"} kg · {product.specification.speedMps ?? "未知"} m/s</td>
                  <td className="px-4 py-3">{product.specification.maxFloors ?? "未知"}</td>
                  <td className="px-4 py-3">{product.price?.minimumAmount ? `¥${product.price.minimumAmount.toLocaleString("zh-CN")} 起` : "待询价"}</td>
                  <td className="px-4 py-3"><span className="demo-badge">{product.verificationStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
