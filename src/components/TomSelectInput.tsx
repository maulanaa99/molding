"use client";

import React, { useEffect, useRef } from "react";
import TomSelectLib from "tom-select";

export interface TomSelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
}

interface TomSelectInputProps {
  id?: string;
  value: string | number;
  onChange: (val: string) => void;
  options: TomSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

export default function TomSelectInput({
  id,
  value,
  onChange,
  options,
  placeholder = "Pilih atau cari...",
  className = "",
  disabled = false,
  allowClear = true,
}: TomSelectInputProps) {
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const tomSelectInstance = useRef<any>(null);

  // Inisialisasi TomSelect saat mount
  useEffect(() => {
    if (!selectRef.current) return;

    try {
      const plugins: any = {};
      if (allowClear) {
        plugins.clear_button = {
          title: "Bersihkan pilihan",
          className: "clear-button text-slate-400 hover:text-rose-600 font-bold",
        };
      }

      tomSelectInstance.current = new TomSelectLib(selectRef.current, {
        valueField: "value",
        labelField: "label",
        searchField: ["label", "sublabel"],
        placeholder: placeholder,
        maxItems: 1,
        closeAfterSelect: true,
        allowEmptyOption: true,
        plugins: plugins,
        render: {
          option: function (data: any, escape: (str: string) => string) {
            return `
              <div class="py-1.5 px-2.5 hover:bg-sky-50 transition cursor-pointer">
                <div class="font-bold text-slate-900 text-xs">${escape(data.label || "")}</div>
                ${
                  data.sublabel
                    ? `<div class="text-[11px] text-slate-500 font-medium">${escape(
                        data.sublabel
                      )}</div>`
                    : ""
                }
              </div>
            `;
          },
          item: function (data: any, escape: (str: string) => string) {
            return `
              <div class="font-bold text-slate-900 text-xs py-0.5">${escape(data.label || "")}</div>
            `;
          },
        },
        onChange: (selectedVal: string) => {
          onChange(selectedVal || "");
        },
      });
    } catch {
      // TomSelect fallback gracefully
    }

    return () => {
      if (tomSelectInstance.current) {
        try {
          tomSelectInstance.current.destroy();
        } catch {
          // ignore
        }
        tomSelectInstance.current = null;
      }
    };
  }, []);

  const prevOptionsJsonRef = useRef<string>("");

  // Update options secara reaktif HANYA jika isi data options benar-benar berubah
  useEffect(() => {
    if (!tomSelectInstance.current) return;

    const currentOptionsJson = JSON.stringify(options);
    if (prevOptionsJsonRef.current === currentOptionsJson) {
      return; // Isi options sama persis, jangan clearOptions agar tidak reset input/dropdown
    }
    prevOptionsJsonRef.current = currentOptionsJson;

    tomSelectInstance.current.clearOptions();
    options.forEach((opt) => {
      tomSelectInstance.current.addOption({
        value: String(opt.value),
        label: opt.label,
        sublabel: opt.sublabel || "",
      });
    });
    const targetVal = value !== null && value !== undefined && value !== "" ? String(value) : "";
    tomSelectInstance.current.setValue(targetVal, true);
    tomSelectInstance.current.refreshOptions(false);
  }, [options, value]);

  // Update nilai jika value dari luar berubah
  useEffect(() => {
    if (tomSelectInstance.current) {
      const currentVal = tomSelectInstance.current.getValue();
      const targetVal = value !== null && value !== undefined && value !== "" ? String(value) : "";
      if (String(currentVal) !== targetVal) {
        tomSelectInstance.current.setValue(targetVal, true);
      }
    }
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <select
        ref={selectRef}
        id={id}
        disabled={disabled}
        className="w-full text-xs font-bold"
        defaultValue={String(value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
