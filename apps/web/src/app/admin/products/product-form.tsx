"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ProductForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const toNumber = (name: string) =>
      form.get(name) ? Number(form.get(name)) : undefined;
    try {
      const response = await fetch("/api/admin/catalog/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manufacturerName: String(form.get("manufacturerName") ?? ""),
          brandName: String(form.get("brandName") ?? ""),
          modelCode: String(form.get("modelCode") ?? ""),
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? "") || undefined,
          applicableScenarios: [...form.getAll("applicableScenarios")].map(String),
          verificationStatus: "DEMO_MOCK",
          sourceReference: "管理端 DEMO_MOCK 录入",
          specification: {
            capacityKg: toNumber("capacityKg"),
            speedMps: toNumber("speedMps"),
            maxFloors: toNumber("maxFloors"),
            maxTravelM: toNumber("maxTravelM"),
            shaftWidthMm: toNumber("shaftWidthMm"),
            shaftDepthMm: toNumber("shaftDepthMm"),
            pitDepthMm: toNumber("pitDepthMm"),
            overheadMm: toNumber("overheadMm"),
            machineRoomType: String(form.get("machineRoomType") ?? "UNKNOWN"),
          },
          price: {
            minimumAmount: toNumber("minimumAmount"),
            maximumAmount: toNumber("maximumAmount"),
            currency: "CNY",
            region: "DEMO",
            validityStatus: "DEMO_MOCK",
            sourceReference: "管理端 DEMO_MOCK 录入",
          },
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "产品保存失败。");
      }
      event.currentTarget.reset();
      setMessage("DEMO_MOCK 产品已保存。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "产品保存失败。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-3" onSubmit={submit}>
      <input className="admin-input" name="manufacturerName" placeholder="虚构厂商名称" required />
      <input className="admin-input" name="brandName" placeholder="虚构品牌" required />
      <input className="admin-input" name="modelCode" placeholder="型号代码" required />
      <input className="admin-input" name="name" placeholder="产品名称" required />
      <input className="admin-input" name="capacityKg" placeholder="载重 kg" type="number" />
      <input className="admin-input" name="speedMps" placeholder="速度 m/s" step="0.01" type="number" />
      <input className="admin-input" name="maxFloors" placeholder="最大层数" type="number" />
      <input className="admin-input" name="maxTravelM" placeholder="最大提升高度 m" step="0.1" type="number" />
      <input className="admin-input" name="shaftWidthMm" placeholder="井道宽 mm" type="number" />
      <input className="admin-input" name="shaftDepthMm" placeholder="井道深 mm" type="number" />
      <input className="admin-input" name="pitDepthMm" placeholder="底坑 mm" type="number" />
      <input className="admin-input" name="overheadMm" placeholder="顶层高度 mm" type="number" />
      <input className="admin-input" name="minimumAmount" placeholder="最低参考价" type="number" />
      <input className="admin-input" name="maximumAmount" placeholder="最高参考价" type="number" />
      <select className="admin-input" name="machineRoomType" defaultValue="MRL">
        <option value="MRL">无机房 MRL</option>
        <option value="MR">有机房 MR</option>
        <option value="UNKNOWN">待确认</option>
      </select>
      <label className="text-sm"><input name="applicableScenarios" type="checkbox" value="OLD_BUILDING_ADDITION" /> 旧楼加装</label>
      <label className="text-sm"><input name="applicableScenarios" type="checkbox" value="EXISTING_ELEVATOR_RENOVATION" /> 旧梯改造</label>
      <label className="text-sm"><input name="applicableScenarios" type="checkbox" value="NEW_BUILDING_INSTALLATION" /> 新楼安装</label>
      {message ? <p className="text-sm text-cyan-800 md:col-span-3">{message}</p> : null}
      <button className="admin-button md:col-span-3" disabled={pending} type="submit">
        {pending ? "正在保存…" : "新增 DEMO_MOCK 产品"}
      </button>
    </form>
  );
}
