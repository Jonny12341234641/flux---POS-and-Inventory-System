import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-DEFAULT disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-emerald-500 text-white shadow-md hover:bg-emerald-600 hover:shadow-lg",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-slate-700 bg-transparent shadow-sm hover:bg-slate-800 hover:text-white text-slate-200",
        secondary: "bg-slate-800 text-slate-50 shadow-sm hover:bg-slate-700",
        ghost: "hover:bg-slate-800 hover:text-slate-50 text-slate-400",
        link: "text-emerald-500 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const loadingIcon = isLoading ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : null;
    const slottedChildren =
      asChild && isValidElement<{ children?: ReactNode }>(children)
        ? isLoading
          ? cloneElement(children, {
              children: (
                <>
                  {loadingIcon}
                  {children.props.children}
                </>
              ),
            })
          : children
        : (
            <>
              {loadingIcon}
              {children}
            </>
          );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {slottedChildren}
      </Comp>
    );
  }
);

Button.displayName = "Button";
