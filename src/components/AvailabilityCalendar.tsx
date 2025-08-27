import React, { useState } from 'react';
import { format, addDays, isSameDay, startOfWeek, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface AvailabilityCalendarProps {
  availableSlots: {
    date: Date;
    slots: TimeSlot[];
  }[];
  onSlotSelect: (date: Date, time: string) => void;
}

export function AvailabilityCalendar({ availableSlots = [], onSlotSelect }: AvailabilityCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    if (selectedDate) {
      onSlotSelect(selectedDate, time);
    }
  };

  const getTimeSlotsForDate = (date: Date) => {
    if (!availableSlots) return [];
    const slot = availableSlots.find((slot) => isSameDay(slot.date, date));
    return slot ? slot.slots : [];
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => setCurrentWeek(addWeeks(currentWeek, -1))}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-semibold">
          {format(currentWeek, 'MMMM d')} - {format(addDays(currentWeek, 6), 'MMMM d, yyyy')}
        </h3>
        <button
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((date) => {
          const hasSlots = getTimeSlotsForDate(date).some((slot) => slot.available);
          const isSelected = selectedDate && isSameDay(date, selectedDate);

          return (
            <button
              key={date.toISOString()}
              onClick={() => hasSlots && handleDateSelect(date)}
              disabled={!hasSlots}
              className={`
                p-4 rounded-lg text-center transition-colors
                ${
                  isSelected
                    ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                    : hasSlots
                    ? 'hover:bg-gray-50 border border-gray-200'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <div className="text-sm">{format(date, 'd')}</div>
              {hasSlots && (
                <div className="text-xs mt-1 text-gray-500">
                  {getTimeSlotsForDate(date).filter((slot) => slot.available).length} slots
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Available times for {format(selectedDate, 'MMMM d, yyyy')}
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {getTimeSlotsForDate(selectedDate).map(
              (slot) =>
                slot.available && (
                  <button
                    key={slot.time}
                    onClick={() => handleTimeSelect(slot.time)}
                    className={`
                      py-2 px-4 rounded-lg text-sm transition-colors
                      ${
                        selectedTime === slot.time
                          ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                          : 'hover:bg-gray-50 border border-gray-200'
                      }
                    `}
                  >
                    {slot.time}
                  </button>
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
