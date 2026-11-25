import Link from "next/link";
import { notFound } from "next/navigation";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireAdminPermission } from "@/modules/auth/page-session";
import { getCatalogProduct } from "@/modules/mvp/store";

import { ProductEditForm } from "./product-edit-form";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireAdminPermission(PERMISSIONS.CATALOG_MANAGE);
  const { productId } = await params;
  const product = await getCatalogProduct(productId);
  if (!product) notFound();
  return (
    <div className="space-y-6">
      <Link className="text-sm text-cyan-800" href="/admin/products">← 返回产品目录</Link>
      <header>
        <p className="text-sm text-slate-500">{product.manufacturer} / {product.brand} / {product.modelCode}</p>
        <h1 className="mt-2 text-3xl font-semibold">编辑 DEMO 产品</h1>
      </header>
      <ProductEditForm product={{
        productId: product.productId,
        name: product.name,
        applicableScenarios: product.applicableScenarios,
        verificationStatus: product.verificationStatus,
        sourceReferences: product.sourceReferences,
        specification: product.specification,
        price: product.price ? {
          minimumAmount: product.price.minimumAmount,
          maximumAmount: product.price.maximumAmount,
          validityStatus: product.price.validityStatus,
        } : undefined,
      }} />
    </div>
  );
}
