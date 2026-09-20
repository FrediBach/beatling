import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => <TabsPrimitive.List ref={ref} className={cn("inline-flex gap-1", className)} {...props} />,
);
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn("rounded-sm border border-rule bg-paper px-3 py-1 text-xs data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-paper", className)}
      {...props}
    />
  ),
);
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = TabsPrimitive.Content;
