"""
Servicio de generación de PDF para facturas — WeasyPrint.
"""

from decimal import Decimal

from weasyprint import HTML  # type: ignore[import-untyped]

from app.models.billing import Invoice


def _fmt_decimal(value: Decimal | None) -> str:
    if value is None:
        return "0,00 €"
    return f"{value:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def _build_html(invoice: Invoice) -> str:
    lines_html = ""
    for line in invoice.lines:
        desc = line.get("description", "")
        qty = line.get("quantity", 1)
        unit_price = _fmt_decimal(Decimal(str(line.get("unit_price_net", 0))))
        iva_rate = line.get("iva_rate", 0)
        line_total = _fmt_decimal(Decimal(str(line.get("line_total_with_iva", 0))))
        lines_html += f"""
        <tr>
          <td>{desc}</td>
          <td class="right">{qty}</td>
          <td class="right">{unit_price}</td>
          <td class="right">{iva_rate}%</td>
          <td class="right">{line_total}</td>
        </tr>"""

    credit_note_badge = ""
    if invoice.is_credit_note:
        credit_note_badge = '<span class="badge-rect">FACTURA RECTIFICATIVA</span>'

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 11px;
          color: #374151; padding: 32px 40px; }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start;
             border-bottom: 2px solid #051937; padding-bottom: 16px; margin-bottom: 24px; }}
  .brand {{ color: #051937; font-size: 22px; font-weight: 700; }}
  .invoice-meta {{ text-align: right; }}
  .invoice-number {{ font-size: 16px; font-weight: 700; color: #051937; }}
  .status-badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px;
                   font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }}
  .badge-rect {{ background: #fef3c7; color: #92400e; }}
  .parties {{ display: flex; gap: 40px; margin-bottom: 24px; }}
  .party {{ flex: 1; }}
  .party-title {{ font-size: 9px; font-weight: 700; color: #6B7280; text-transform: uppercase;
                  letter-spacing: 0.5px; margin-bottom: 4px; }}
  .party-name {{ font-weight: 600; font-size: 12px; color: #051937; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 16px; }}
  thead {{ background: #051937; color: #fff; }}
  thead th {{ padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 600;
              text-transform: uppercase; letter-spacing: 0.3px; }}
  tbody tr:nth-child(even) {{ background: #f9fafb; }}
  tbody td {{ padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }}
  .right {{ text-align: right; }}
  .totals {{ width: 240px; margin-left: auto; }}
  .totals-row {{ display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }}
  .totals-total {{ border-top: 2px solid #051937; padding-top: 6px; margin-top: 4px;
                   font-weight: 700; font-size: 13px; color: #051937; }}
  .footer {{ margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb;
             font-size: 9px; color: #9ca3af; text-align: center; }}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="brand">{invoice.issuer_name or "Empresa"}</div>
    <div style="color:#6B7280;margin-top:4px">{invoice.issuer_cif or ""}</div>
    <div style="color:#6B7280">{invoice.issuer_address or ""}</div>
  </div>
  <div class="invoice-meta">
    <div class="invoice-number">{invoice.invoice_number}</div>
    {credit_note_badge}
    <div style="color:#6B7280;margin-top:6px">
      Fecha: {invoice.issued_at.strftime("%d/%m/%Y")}
    </div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="party-title">Emisor</div>
    <div class="party-name">{invoice.issuer_name or "—"}</div>
    <div>{invoice.issuer_cif or ""}</div>
    <div>{invoice.issuer_address or ""}</div>
  </div>
  <div class="party">
    <div class="party-title">Receptor</div>
    <div class="party-name">{invoice.recipient_name}</div>
    <div>{invoice.recipient_nif or ""}</div>
    <div>{invoice.recipient_address or ""}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Concepto</th>
      <th class="right">Cant.</th>
      <th class="right">Precio neto</th>
      <th class="right">IVA</th>
      <th class="right">Total</th>
    </tr>
  </thead>
  <tbody>
    {lines_html}
  </tbody>
</table>

<div class="totals">
  <div class="totals-row">
    <span>Base imponible</span><span>{_fmt_decimal(invoice.base_imponible)}</span>
  </div>
  <div class="totals-row">
    <span>IVA</span><span>{_fmt_decimal(invoice.total_iva)}</span>
  </div>
  <div class="totals-row totals-total">
    <span>TOTAL</span><span>{_fmt_decimal(invoice.total_with_iva)}</span>
  </div>
</div>

{"<div style='margin-top:12px;font-size:9px;color:#6B7280'>Método de pago: " + invoice.payment_method_name + "</div>" if invoice.payment_method_name else ""}

<div class="footer">
  Documento generado electrónicamente · {invoice.invoice_number}
</div>

</body>
</html>"""


def generate_invoice_pdf(invoice: Invoice) -> bytes:
    html_content = _build_html(invoice)
    return HTML(string=html_content).write_pdf()
