import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id?: string;
  value?: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  disabled?: boolean;
  onSelect?: (value: string) => void;
  triggerClassName?: string;
  contentClassName?: string;
}

export function SearchableSelect({
  id,
  value,
  options,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found",
  loading = false,
  loadingMessage = "Loading...",
  disabled = false,
  onSelect,
  triggerClassName,
  contentClassName,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const touchInteractionRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    moved: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const detectTouchDevice = () => {
      const coarsePointer =
        typeof window.matchMedia === "function"
          ? window.matchMedia("(pointer: coarse)").matches
          : false;
      const hasTouchPoints =
        typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

      setIsTouchDevice(coarsePointer || hasTouchPoints);
    };

    detectTouchDevice();

    if (typeof window.matchMedia === "function") {
      const mediaQuery = window.matchMedia("(pointer: coarse)");

      const handleChange = () => {
        detectTouchDevice();
      };

      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }

      if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, []);

  const selectedOption = useMemo(() => {
    if (!value) return undefined;

    return options.find((option) => option.value === value);
  }, [options, value]);

  const displayLabel = selectedOption?.label ?? value ?? placeholder;

  const handleOptionSelect = (optionValue: string) => {
    onSelect?.(optionValue);
    setOpen(false);
  };

  const resetTouchInteraction = () => {
    touchInteractionRef.current.pointerId = null;
    touchInteractionRef.current.moved = false;
    touchInteractionRef.current.startX = 0;
    touchInteractionRef.current.startY = 0;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTouchDevice) {
      return;
    }

    if (event.pointerType === "touch") {
      touchInteractionRef.current.pointerId = event.pointerId;
      touchInteractionRef.current.startX = event.clientX;
      touchInteractionRef.current.startY = event.clientY;
      touchInteractionRef.current.moved = false;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTouchDevice || event.pointerType !== "touch") {
      return;
    }

    const interaction = touchInteractionRef.current;

    if (interaction.pointerId !== event.pointerId || interaction.moved) {
      return;
    }

    const deltaX = Math.abs(event.clientX - interaction.startX);
    const deltaY = Math.abs(event.clientY - interaction.startY);

    if (deltaX > 10 || deltaY > 10) {
      interaction.moved = true;
    }
  };

  const handlePointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
    optionValue: string,
  ) => {
    if (!isTouchDevice) {
      return;
    }

    if (event.pointerType === "touch") {
      const interaction = touchInteractionRef.current;

      if (interaction.pointerId === event.pointerId && !interaction.moved) {
        handleOptionSelect(optionValue);
      }

      resetTouchInteraction();
      return;
    }

    handleOptionSelect(optionValue);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTouchDevice || event.pointerType !== "touch") {
      return;
    }

    if (touchInteractionRef.current.pointerId === event.pointerId) {
      resetTouchInteraction();
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled) return;
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal",
            !value && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-[var(--radix-popover-trigger-width)] p-0",
          "max-h-[min(calc(100vh-8rem),24rem)]",
          "flex flex-col overflow-hidden",
          contentClassName,
        )}
      >
        <Command className="flex-1 overflow-hidden">
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-none flex-1 overflow-y-auto overscroll-contain">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {loading ? (
              <CommandItem value="__loading" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {loadingMessage}
              </CommandItem>
            ) : null}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  onSelect={() => handleOptionSelect(option.value)}
                  disablePointerSelection={isTouchDevice}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(event) => handlePointerUp(event, option.value)}
                  onPointerCancel={handlePointerCancel}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      option.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
