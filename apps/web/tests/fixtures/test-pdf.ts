function escapePdfText(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

export function createTestPdf(pageTexts: string[]): Buffer {
  const objects: string[] = [];
  const pageReferences = pageTexts.map(
    (_, index) => `${4 + index * 2} 0 R`,
  );
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageReferences.join(" ")}] /Count ${pageTexts.length} >>`,
  );
  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );

  pageTexts.forEach((text, index) => {
    const contentObject = 5 + index * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`,
    );
    const stream = text
      ? `BT /F1 12 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`
      : "";
    objects.push(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}
