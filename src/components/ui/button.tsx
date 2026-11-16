import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex pointer-coarse:min-h-11 shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Principal: petróleo. */
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        /** Secundário: branco com borda. */
        outline:
          "border-input bg-card text-foreground hover:bg-muted aria-expanded:bg-muted dark:bg-input/30 dark:hover:bg-input/50",
        /** Suave: fundo névoa. */
        secondary:
          "bg-accent text-accent-foreground hover:bg-[color-mix(in_oklab,var(--accent),var(--primary)_10%)] aria-expanded:bg-[color-mix(in_oklab,var(--accent),var(--primary)_10%)]",
        /** Sobre fundo escuro (petróleo profundo). */
        "on-dark":
          "bg-brand-highlight text-brand-deep hover:bg-[color-mix(in_oklab,var(--brand-highlight),white_15%)] focus-visible:ring-offset-brand-deep",
        ghost:
          "text-foreground hover:bg-muted aria-expanded:bg-muted dark:hover:bg-muted/50",
        destructive:
          "bg-destructive-soft text-destructive hover:bg-[color-mix(in_oklab,var(--destructive-soft),var(--destructive)_12%)] focus-visible:ring-destructive",
        /** Perigo cheio, para a confirmação final de algo irreversível. */
        danger: "bg-destructive text-white hover:bg-[color-mix(in_oklab,var(--destructive),black_12%)] focus-visible:ring-destructive",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8125rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10 pointer-coarse:min-w-11",
        "icon-xs":
          "size-6 pointer-coarse:min-w-11 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 pointer-coarse:min-w-11 rounded-md in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
