"use client";

import React from "react";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RefundOrder, RefundOrderStatus } from "@/types";
import {
  REFUND_ORDER_STATUS_LABELS,
  REFUND_ORDER_STATUS_COLORS,
} from "@/types";

interface RefundOrderTableProps {
  orders: RefundOrder[];
  onProcess?: (order: RefundOrder) => void;
}

const STATUS_ICONS: Record<RefundOrderStatus, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  processed: <CheckCircle className="h-3.5 w-3.5" />,
  rejected: <XCircle className="h-3.5 w-3.5" />,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(amount: string): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(parseFloat(amount));
}

export function RefundOrderTable({ orders, onProcess }: RefundOrderTableProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-8 py-12 text-center">
        <p className="text-sm text-klyp-gray">No hay órdenes de devolución.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-klyp-pale">
      <Table>
        <TableHeader>
          <TableRow className="bg-klyp-pale/40">
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-klyp-gray">
              Reserva
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-klyp-gray">
              Total pagado
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-klyp-gray">
              Reembolso
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-klyp-gray">
              Días antelación
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-klyp-gray">
              Estado
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-klyp-gray">
              Fecha
            </TableHead>
            {onProcess && (
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-klyp-gray">
                Acción
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="hover:bg-klyp-pale/20 transition-colors"
            >
              <TableCell className="font-mono text-xs text-klyp-gray">
                {order.reservation_id.slice(0, 8)}...
              </TableCell>
              <TableCell className="font-medium text-klyp-text-dark">
                {formatCurrency(order.total_paid)}
              </TableCell>
              <TableCell>
                <div>
                  <span className="font-semibold text-klyp-navy">
                    {formatCurrency(order.refund_amount)}
                  </span>
                  <span className="ml-1 text-xs text-klyp-gray">
                    ({order.refund_percentage}%)
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-klyp-text-dark">
                {order.days_before_checkin}d
              </TableCell>
              <TableCell>
                <Badge
                  className={`inline-flex items-center gap-1 text-xs font-medium ${REFUND_ORDER_STATUS_COLORS[order.status]}`}
                >
                  {STATUS_ICONS[order.status]}
                  {REFUND_ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-klyp-gray">
                {formatDate(order.created_at)}
              </TableCell>
              {onProcess && (
                <TableCell>
                  {order.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onProcess(order)}
                      className="h-8 border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10 text-xs"
                    >
                      Gestionar
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
