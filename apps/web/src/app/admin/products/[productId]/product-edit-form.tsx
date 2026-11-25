"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Product {
  productId: string;
  name: string;
  applicableScenarios: string[];
  verificationStatus: string;
  sourceReferences: string[];
  specification: {
    capacityKg?: number;
    speedMps?: number;
    maxFloors?: number;
    maxTravelM?: number;
    shaftWidthMm?: number;
    shaftDepthMm?: number;
    pitDepthMm?: number;
    overheadMm?: number;
    machineRoomType?: string;
  };
  price?: {
    minimumAmount?: number;
    maximumAmount?: number;
    validityStatus: string;
  };
}

export function ProductEditForm({ product }: { product: Product }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (name: string) =>
      form.get(name) ? Number(form.get(name)) : undefined;
    const response = await fetch(`/api/admin/catalog/products/${product.productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        applicableScenarios: [...form.getAll("applicableScenarios")].map(String),
        verificationStatus: String(form.get("verificationStatus") ?? ""),
        sourceReference: product.sourceReferences[0],
        specification: {
          capacityKg: number("capacityKg"),
          speedMps: number("speedMps"),
          maxFloors: number("maxFloors"),
          maxTravelM: number("maxTravelM"),
          shaftWidthMm: number("shaftWidthMm"),
          shaftDepthMm: number("shaftDepthMm"),
          pitDepthMm: number("pitDepthMm"),
          overheadMm: number("overheadMm"),
          machineRoomType: String(form.get("machineRoomType") ?? "UNKNOWN"),
        },
        price: {
          minimumAmount: number("minimumAmount"),
          maximumAmount: number("maximumAmount"),
          currency: "CNY",
          region: "DEMO",
          validityStatus: String(form.get("validityStatus") ?? "DEMO_MOCK"),
          sourceReference: product.sourceReferences[0],
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    setMessage(response.ok ? "已生成新的规格版本。" : body?.error?.message ?? "保存失败。");
    if (response.ok) router.refresh();
  }

  return (
    <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-3" onSubmit={submit}>
      <input className="admin-input" defaultValue={product.name} name="name" required />
      <select className="admin-input" defaultValue={product.verificationStatus} name="verificationStatus">
        <option value="DEMO_MOCK">DEMO_MOCK</option>
        <option value="UNVERIFIED">UNVERIFIED</option>
        <option value="VERIFIED">VERIFIED</option>
        <option value="EXPIRED">EXPIRED</option>
      </select>
      <select className="admin-input" name="machineRoomType" defaultValue={product.specification.machineRoomType ?? "UNKNOWN"}>
        <option value="MRL">MRL</option><option value="MR">MR</option><option value="UNKNOWN">UNKNOWN</option>
      </select>
      {["capacityKg","speedMps","maxFloors","maxTravelM","shaftWidthMm","shaftDepthMm","pitDepthMm","overheadMm"].map((name) => (
        <input className="admin-input" defaultValue={product.specification[name as keyof Product["specification"]] ?? ""} key={name} name={name} placeholder={name} type="number" />
      ))}
      <input className="admin-input" defaultValue={product.price?.minimumAmount ?? ""} name="minimumAmount" placeholder="最低价" type="number" />
      <input className="admin-input" defaultValue={product.price?.maximumAmount ?? ""} name="maximumAmount" placeholder="最高价" type="number" />
      <select className="admin-input" defaultValue={product.price?.validityStatus ?? "DEMO_MOCK"} name="validityStatus">
        <option value="DEMO_MOCK">DEMO_MOCK</option><option value="VALID">VALID</option><option value="EXPIRED">EXPIRED</option>
      </select>
      {["OLD_BUILDING_ADDITION","EXISTING_ELEVATOR_RENOVATION","NEW_BUILDING_INSTALLATION"].map((scenario) => (
        <label className="text-sm" key={scenario}>
          <input defaultChecked={product.applicableScenarios.includes(scenario)} name="applicableScenarios" type="checkbox" value={scenario} /> {scenario}
        </label>
      ))}
      <button className="admin-button md:col-span-3" type="submit">保存并生成新规格版本</button>
      {message ? <p className="text-sm text-cyan-800 md:col-span-3">{message}</p> : null}
    </form>
  );
}
