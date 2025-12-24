'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import type { Patient } from '@/types/care-coordination';

interface PatientAutocompleteProps {
  value?: Patient | null;
  onChange: (patient: Patient | null) => void;
  placeholder?: string;
  required?: boolean;
}

export function PatientAutocomplete({
  value,
  onChange,
  placeholder = 'Search patient by name or MRN...',
  required = false,
}: PatientAutocompleteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const text = `${value.last_name}, ${value.first_name} (${value.mrn})`;
      setDisplayText(text);
      setHasSelection(true);
    } else {
      setDisplayText('');
      setHasSelection(false);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchPatients = async () => {
      // Don't search if we have a selection or query is too short
      if (hasSelection || !searchQuery || searchQuery.length < 2) {
        setResults([]);
        if (!hasSelection) setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/patients/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        setResults(Array.isArray(data) ? data : []);
        setIsOpen(true);
      } catch (error) {
        console.error('Error searching patients:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchPatients, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, hasSelection]);

  const handleSelect = (patient: Patient) => {
    onChange(patient);
    const text = `${patient.last_name}, ${patient.first_name} (${patient.mrn})`;
    setDisplayText(text);
    setSearchQuery('');
    setHasSelection(true);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayText(newValue);
    setSearchQuery(newValue);
    setHasSelection(false);
    if (!newValue) {
      onChange(null);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
        <Input
          value={displayText}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          className="pl-10 border-[#D4D4D4]"
          autoComplete="off"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#D4D4D4] rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onClick={() => handleSelect(patient)}
              className="w-full px-4 py-3 text-left hover:bg-[#FAFAF8] border-b border-[#D4D4D4] last:border-b-0 transition-colors"
            >
              <div className="font-medium text-[#1A1A1A]">
                {patient.last_name}, {patient.first_name}
              </div>
              <div className="text-sm text-[#666] mt-1">
                <span className="font-medium">MRN:</span> {patient.mrn}
                {patient.diagnosis && (
                  <span className="ml-3">
                    <span className="font-medium">Diagnosis:</span> {patient.diagnosis}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#D4D4D4] rounded-lg shadow-lg p-4 text-center text-sm text-[#666]">
          Searching...
        </div>
      )}

      {isOpen && !isLoading && searchQuery.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#D4D4D4] rounded-lg shadow-lg p-4 text-center text-sm text-[#666]">
          No patients found
        </div>
      )}
    </div>
  );
}
