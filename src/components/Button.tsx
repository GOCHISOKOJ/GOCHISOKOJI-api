import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      size: {
        sm: 'h-[44px] px-4 min-w-[80px] text-sm',
        md: 'h-[48px] px-6 min-w-[100px]',
        lg: 'h-[56px] px-8 min-w-[120px] text-lg',
      },
      tone: {
        primary: 'bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 shadow-soft',
        secondary: 'bg-secondary text-secondary-foreground hover:opacity-90 active:opacity-80 shadow-soft',
        ghost: 'bg-transparent text-foreground hover:bg-muted active:bg-muted/80',
      },
    },
    defaultVariants: {
      size: 'md',
      tone: 'primary',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ 
  className, 
  size, 
  tone, 
  children,
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ size, tone }), className)}
      {...props}
    >
      {children}
    </button>
  );
}







