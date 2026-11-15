import { PERMISSIONS } from "@/modules/access/permissions";
import { requireAdminPermission } from "@/modules/auth/page-session";
import { listCustomers } from "@/modules/projects/service";

import { CustomerForm } from "./customer-form";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireAdminPermission(PERMISSIONS.CUSTOMER_READ);
  const customers = await listCustomers();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-cyan-800">客户</p>
        <h1 className="mt-1 text-3xl font-semibold">DEMO 客户档案</h1>
        <p className="mt-2 text-slate-600">
          本阶段只保存基础联系档案，所有记录均标记为 DEMO_MOCK。
        </p>
      </header>
      <CustomerForm />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {customers.length === 0 ? (
          <p className="p-6 text-slate-500">尚无客户记录。</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">客户名称</th>
                <th className="px-4 py-3">联系人</th>
                <th className="px-4 py-3">联系电话</th>
                <th className="px-4 py-3">项目数</th>
                <th className="px-4 py-3">数据分类</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr className="border-t border-slate-100" key={customer.id}>
                  <td className="px-4 py-3 font-medium">
                    {customer.organizationName}
                  </td>
                  <td className="px-4 py-3">{customer.contactName}</td>
                  <td className="px-4 py-3">
                    {customer.contactPhone ?? "未填写"}
                  </td>
                  <td className="px-4 py-3">{customer._count.projects}</td>
                  <td className="px-4 py-3">
                    <span className="demo-badge">
                      {customer.dataClassification}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
