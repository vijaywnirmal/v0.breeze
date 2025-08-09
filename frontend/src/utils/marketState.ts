export interface MarketState {
  isOpen: boolean;
  isWeekend: boolean;
  relevantDate: Date;
  previousDate: Date;
  marketStatus: 'open' | 'closed' | 'pre-open' | 'weekend';
  description: string;
}

export function getMarketState(): MarketState {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Convert to IST
  const weekday = istTime.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  
  const todayOpen = new Date(istTime);
  todayOpen.setHours(9, 15, 0, 0);
  
  const todayClose = new Date(istTime);
  todayClose.setHours(15, 30, 0, 0);
  
  // Use 15:30:00 for the closing candle (30-minute interval)
  const todayCloseCandle = new Date(istTime);
  todayCloseCandle.setHours(15, 30, 0, 0);
  
  // Weekend logic
  if (weekday === 0 || weekday === 6) { // Sunday or Saturday
    const friday = new Date(istTime);
    const daysToSubtract = weekday === 0 ? 2 : 1; // Sunday: go back 2 days, Saturday: go back 1 day
    friday.setDate(friday.getDate() - daysToSubtract);
    friday.setHours(15, 30, 0, 0); // Use 15:30:00 for Friday's closing candle
    
    const previousFriday = new Date(friday);
    previousFriday.setDate(previousFriday.getDate() - 7);
    previousFriday.setHours(15, 30, 0, 0);
    
          return {
        isOpen: false,
        isWeekend: true,
        relevantDate: friday,
        previousDate: previousFriday,
        marketStatus: 'weekend',
        description: 'Market closed (Weekend)'
      };
  }
  
  // Weekday logic
  const currentTime = istTime.getTime();
  const openTime = todayOpen.getTime();
  const closeTime = todayClose.getTime();
  
  // Before market open (before 09:15 IST)
  if (currentTime < openTime) {
    const yesterday = new Date(istTime);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // If yesterday was a weekend, go back to Friday
    const yesterdayWeekday = yesterday.getDay();
    if (yesterdayWeekday === 0) { // Sunday
      yesterday.setDate(yesterday.getDate() - 2);
    } else if (yesterdayWeekday === 6) { // Saturday
      yesterday.setDate(yesterday.getDate() - 1);
    }
    
    yesterday.setHours(15, 30, 0, 0); // Use 15:30:00 for yesterday's closing candle
    
    const dayBeforeYesterday = new Date(yesterday);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
    if (dayBeforeYesterday.getDay() === 0) {
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    } else if (dayBeforeYesterday.getDay() === 6) {
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
    }
    dayBeforeYesterday.setHours(15, 30, 0, 0);
    
          return {
        isOpen: false,
        isWeekend: false,
        relevantDate: yesterday,
        previousDate: dayBeforeYesterday,
        marketStatus: 'pre-open',
        description: 'Market not yet open'
      };
  }
  
  // After market close (after 15:30 IST)
  if (currentTime > closeTime) {
    const dayBeforeYesterday = new Date(istTime);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
    
    // If day before yesterday was a weekend, go back to Friday
    const dayBeforeYesterdayWeekday = dayBeforeYesterday.getDay();
    if (dayBeforeYesterdayWeekday === 0) { // Sunday
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    } else if (dayBeforeYesterdayWeekday === 6) { // Saturday
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
    }
    
    dayBeforeYesterday.setHours(15, 30, 0, 0);
    
          return {
        isOpen: false,
        isWeekend: false,
        relevantDate: todayCloseCandle, // Use 15:30:00 for today's closing candle
        previousDate: dayBeforeYesterday,
        marketStatus: 'closed',
        description: 'Market closed'
      };
  }
  
  // Market is open (between 09:15-15:30 IST)
  const yesterday = new Date(istTime);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // If yesterday was a weekend, go back to Friday
  const yesterdayWeekday = yesterday.getDay();
  if (yesterdayWeekday === 0) { // Sunday
    yesterday.setDate(yesterday.getDate() - 2);
  } else if (yesterdayWeekday === 6) { // Saturday
    yesterday.setDate(yesterday.getDate() - 1);
  }
  
  yesterday.setHours(15, 30, 0, 0); // Use 15:30:00 for yesterday's closing candle
  
  return {
    isOpen: true,
    isWeekend: false,
    relevantDate: yesterday, // Show yesterday's close during market hours
    previousDate: yesterday,
    marketStatus: 'open',
    description: 'Market is open'
  };
}

export function formatISTTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function isMarketHoliday(): boolean {
  // TODO: Implement holiday calendar lookup
  // For now, assume no holidays
  return false;
}
