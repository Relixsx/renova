import ExcelJS from "exceljs";
import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { requireOwnerRequest } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";

type OrderItem = {
  name?: string;
  sku?: string;
  variant?: string;
  quantity?: number;
  unitPriceKobo?: number;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function watDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + 60 * 60 * 1000);
}

function dateParameter(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+01:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayDate(value: string) {
  return new Date(`${value}T00:00:00+01:00`).toLocaleDateString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusColours(status: string) {
  const normalized = status.toLowerCase();
  if (["paid", "delivered", "confirmed", "successful"].includes(normalized)) {
    return { fill: "E8F5EC", font: "176B35" };
  }
  if (["pending", "payment pending", "payment due on delivery", "processing", "packaged"].includes(normalized)) {
    return { fill: "FFF4D6", font: "825400" };
  }
  if (["failed", "cancelled", "refunded"].includes(normalized)) {
    return { fill: "FDE8E7", font: "A1271B" };
  }
  return { fill: "F1F1F1", font: "454545" };
}

export async function GET(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;

  try {
    const requestUrl = new URL(request.url);
    const startValue = requestUrl.searchParams.get("startDate");
    const endValue = requestUrl.searchParams.get("endDate");
    const hasDateFilter = Boolean(startValue || endValue);
    const startDate = dateParameter(startValue);
    const endDate = dateParameter(endValue);

    if (hasDateFilter && (!startDate || !endDate)) {
      return Response.json(
        { error: "Choose both a valid start date and end date." },
        { status: 400 },
      );
    }
    if (startDate && endDate && startDate > endDate) {
      return Response.json(
        { error: "The start date cannot be after the end date." },
        { status: 400 },
      );
    }

    const allOrders = await getDb()
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
    const endExclusive = endDate
      ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
      : null;
    const orderRows = startDate && endExclusive
      ? allOrders.filter((order) => {
          const createdAt = new Date(order.createdAt);
          return !Number.isNaN(createdAt.getTime()) && createdAt >= startDate && createdAt < endExclusive;
        })
      : allOrders;
    const reportingPeriod = startValue && endValue
      ? `${displayDate(startValue)} to ${displayDate(endValue)}`
      : "All recorded orders";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Renova Store";
    workbook.company = "Renova";
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet("Orders", {
      views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
    });

    const columns = [
      ["Order Number", 23], ["Order Date & Time (WAT)", 23], ["Customer Name", 24],
      ["Phone Number", 18], ["Email", 29], ["Payment Method", 19],
      ["Payment Status", 21], ["Fulfilment Status", 20], ["Products Ordered", 40],
      ["SKUs", 22], ["Variants", 24], ["Total Quantity", 15],
      ["Items Subtotal (₦)", 20], ["Delivery Fee (₦)", 18], ["Order Total (₦)", 19],
      ["Street Address", 34], ["City / Town", 19], ["LGA", 19], ["State", 16],
      ["Delivery Instructions", 30], ["Delivery Method", 24], ["Delivery Details", 31],
      ["Estimated Delivery", 21], ["Tracking Number", 24], ["Customer Notified (WAT)", 24],
      ["Last Updated (WAT)", 23],
    ] as const;

    sheet.columns = columns.map(([header, width]) => ({ header, width }));
    sheet.mergeCells(1, 1, 1, columns.length);
    sheet.getCell("A1").value = "RENOVA ORDER REGISTER";
    sheet.getCell("A1").font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF15B26" } };
    sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(1).height = 36;

    sheet.mergeCells(2, 1, 2, columns.length);
    sheet.getCell("A2").value = `Period: ${reportingPeriod}  •  Generated ${new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })} WAT  •  ${orderRows.length} order${orderRows.length === 1 ? "" : "s"}`;
    sheet.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF5E5652" } };
    sheet.getCell("A2").alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(2).height = 22;
    sheet.getRow(3).height = 8;

    const headerRow = sheet.getRow(4);
    columns.forEach(([header], index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF211A17" } };
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      cell.border = { bottom: { style: "medium", color: { argb: "FFF15B26" } } };
    });
    headerRow.height = 34;

    for (const order of orderRows) {
      const items = parseJson<OrderItem[]>(order.itemsJson, []);
      const address = parseJson<Record<string, unknown>>(order.addressJson, {});
      const shipping = parseJson<Record<string, unknown>>(order.shippingJson, {});
      const quantity = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
      const subtotalKobo = items.reduce(
        (sum, item) => sum + (Number(item.unitPriceKobo) || 0) * Math.max(0, Number(item.quantity) || 0),
        0,
      );
      const deliveryFeeKobo = Number(shipping.priceKobo) || Math.max(0, order.totalKobo - subtotalKobo);
      const productLines = items.map((item) => `${Math.max(1, Number(item.quantity) || 1)} × ${text(item.name) || "Product"}`);

      const row = sheet.addRow([
        order.orderNumber,
        watDate(order.createdAt),
        order.customerName,
        order.customerPhone,
        order.customerEmail,
        titleCase(order.paymentMethod),
        titleCase(order.paymentStatus),
        titleCase(order.status),
        productLines.join("\n"),
        items.map((item) => text(item.sku)).filter(Boolean).join("\n"),
        items.map((item) => text(item.variant) || "Standard").join("\n"),
        quantity,
        subtotalKobo / 100,
        deliveryFeeKobo / 100,
        order.totalKobo / 100,
        text(address.streetAddress),
        text(address.cityTown),
        text(address.lga),
        text(address.stateName || address.state || address.stateCode),
        text(address.deliveryInstructions),
        text(shipping.name),
        text(shipping.detail),
        text(order.estimatedDelivery),
        text(order.trackingNumber),
        watDate(order.customerNotifiedAt),
        watDate(order.updatedAt),
      ]);

      row.height = Math.max(26, Math.min(72, productLines.length * 18));
      row.eachCell((cell, columnNumber) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = { bottom: { style: "hair", color: { argb: "FFD9D3D0" } } };
        if (row.number % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFAF7" } };
        }
        if ([4, 5, 10, 24].includes(columnNumber)) cell.numFmt = "@";
      });

      row.getCell(2).numFmt = "dd mmm yyyy, hh:mm AM/PM";
      [13, 14, 15].forEach((columnNumber) => {
        row.getCell(columnNumber).numFmt = '₦#,##0.00;[Red]-₦#,##0.00';
      });
      [7, 8].forEach((columnNumber) => {
        const cell = row.getCell(columnNumber);
        const colours = statusColours(text(cell.value));
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${colours.fill}` } };
        cell.font = { bold: true, color: { argb: `FF${colours.font}` } };
      });
      [25, 26].forEach((columnNumber) => {
        row.getCell(columnNumber).numFmt = "dd mmm yyyy, hh:mm AM/PM";
      });
    }

    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };
    sheet.getColumn(12).alignment = { horizontal: "center", vertical: "top" };
    sheet.getColumn(12).numFmt = "0";
    sheet.headerFooter.oddFooter = "Renova • Confidential order export • Page &P of &N";

    const data = await workbook.xlsx.writeBuffer();
    const stamp = startValue && endValue
      ? `${startValue}_to_${endValue}`
      : new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Renova_Orders_${stamp}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Order spreadsheet export failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "The order spreadsheet could not be generated." },
      { status: 500 },
    );
  }
}
