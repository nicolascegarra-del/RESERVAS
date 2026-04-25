import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-klyp-accent text-white hover:bg-klyp-navy-light",
        secondary:
          "border-transparent bg-klyp-pale text-klyp-text-dark hover:bg-klyp-pale/80",
        destructive:
          "border-transparent bg-red-100 text-red-800",
        outline: "text-klyp-text-dark border-klyp-pale",
        "super-admin":
          "border-transparent bg-purple-100 text-purple-800",
        "company-admin":
          "border-transparent bg-blue-100 text-blue-800",
        reception:
          "border-transparent bg-green-100 text-green-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
