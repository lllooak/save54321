import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Calendar, Clock, MessageCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { GiftOptions } from './GiftOptions';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: {
    name: string;
    price: number;
    deliveryTime: string;
  };
}

const GIFT_OPTIONS = [
  {
    id: 'download',
    title: 'Download Rights',
    description: 'Get full download rights for the video',
    price: 10,
    icon: 'download',
  },
  {
    id: 'gift',
    title: 'Gift Wrapping',
    description: 'Add a special digital gift wrap effect',
    price: 5,
    icon: 'gift',
  },
  {
    id: 'share',
    title: 'Social Share',
    description: 'Get a special shareable link with custom preview',
    price: 8,
    icon: 'share',
  },
];

// Mock available dates (next 14 days with random availability)
const AVAILABLE_SLOTS = Array.from({ length: 14 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() + i);
  return {
    date,
    slots: Array.from({ length: 8 }, (_, j) => ({
      time: `${9 + j * 2}:00`,
      available: Math.random() > 0.5,
    })),
  };
}).filter((slot) => slot.slots.some((s) => s.available));

export function BookingModal({ isOpen, onClose, creator }: BookingModalProps) {
  const [occasion, setOccasion] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState<string>('');
  const [selectedGiftOptions, setSelectedGiftOptions] = useState<string[]>([]);
  const [deadlineDate, setDeadlineDate] = useState<string>('');

  // Calculate minimum deadline date (tomorrow)
  const tomorrow = addDays(new Date(), 1);
  const minDeadlineDate = format(tomorrow, 'yyyy-MM-dd');

  // Calculate default deadline date (7 days from now)
  const defaultDeadline = addDays(new Date(), 7);
  
  // Set default deadline when component mounts
  React.useEffect(() => {
    setDeadlineDate(format(defaultDeadline, 'yyyy-MM-dd'));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle booking submission
    console.log({
      occasion,
      instructions,
      selectedDate,
      selectedTime,
      eventDate,
      selectedGiftOptions,
      deadlineDate,
    });
    onClose();
  };

  const handleGiftOptionToggle = (optionId: string) => {
    setSelectedGiftOptions((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  };

  const totalPrice =
    creator.price +
    selectedGiftOptions.reduce((sum, optionId) => {
      const option = GIFT_OPTIONS.find((opt) => opt.id === optionId);
      return sum + (option?.price || 0);
    }, 0);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center"
                >
                  Book {creator.name}
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="mt-4 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Occasion
                        </label>
                        <select
                          value={occasion}
                          onChange={(e) => setOccasion(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          required
                        >
                          <option value="">Select an occasion</option>
                          <option value="birthday">Birthday</option>
                          <option value="anniversary">Anniversary</option>
                          <option value="congratulations">Congratulations</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Event Date
                        </label>
                        <input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Deadline Date <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Calendar className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="date"
                            value={deadlineDate}
                            onChange={(e) => setDeadlineDate(e.target.value)}
                            min={minDeadlineDate}
                            className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                            required
                          />
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          This is the date by which you need the video to be delivered.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Instructions
                        </label>
                        <textarea
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          rows={4}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          placeholder="What would you like them to say?"
                          required
                        />
                      </div>

                      <GiftOptions
                        options={GIFT_OPTIONS}
                        selectedOptions={selectedGiftOptions}
                        onOptionSelect={handleGiftOptionToggle}
                      />
                    </div>

                    <div>
                      <AvailabilityCalendar
                        availableSlots={AVAILABLE_SLOTS}
                        onSlotSelect={(date, time) => {
                          setSelectedDate(date);
                          setSelectedTime(time);
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 -mx-6 -mb-6 px-6 py-3 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-1" />
                        Delivery within {creator.deliveryTime}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total Price</p>
                        <p className="text-lg font-semibold">${totalPrice}</p>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Confirm Booking
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
