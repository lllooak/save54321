import React from 'react';
import { Gift, Download, Share2 } from 'lucide-react';

interface GiftOption {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: 'gift' | 'download' | 'share';
}

interface GiftOptionsProps {
  options: GiftOption[];
  selectedOptions: string[];
  onOptionSelect: (id: string) => void;
}

export function GiftOptions({ options, selectedOptions, onOptionSelect }: GiftOptionsProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'gift':
        return <Gift className="w-6 h-6" />;
      case 'download':
        return <Download className="w-6 h-6" />;
      case 'share':
        return <Share2 className="w-6 h-6" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Additional Options</h3>
      <div className="grid gap-4">
        {options.map((option) => (
          <label
            key={option.id}
            className={`
              relative flex items-start p-4 cursor-pointer rounded-lg border-2 transition-colors
              ${selectedOptions.includes(option.id)
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <input
              type="checkbox"
              className="sr-only"
              name="gift-option"
              checked={selectedOptions.includes(option.id)}
              onChange={() => onOptionSelect(option.id)}
            />
            <div className="flex items-center">
              <div className={`
                p-2 rounded-lg
                ${selectedOptions.includes(option.id) ? 'text-primary-600 bg-primary-100' : 'text-gray-500 bg-gray-100'}
              `}>
                {getIcon(option.icon)}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">{option.title}</p>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
            </div>
            <div className="ml-auto pl-4">
              <p className="text-sm font-medium text-gray-900">+${option.price}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
