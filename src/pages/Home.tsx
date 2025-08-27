import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Star, Video, Users } from 'lucide-react';
import { trackAffiliateVisit } from '../utils/affiliate';

export function Home() {
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');

  // Track affiliate visit if ref code is present
  useEffect(() => {
    if (refCode) {
      trackAffiliateVisit(refCode);
    }
  }, [refCode]);

  return (
    <div className="bg-black text-white">
      {/* Hero Section */}
      <div className="relative bg-black">
        <div className="absolute inset-0">
          <img
            className="w-full h-full object-cover opacity-40"
            src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2830&q=80"
            alt="People working"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black"></div>
        </div>
        <div className="relative max-w-7xl mx-auto py-24 px-4 sm:py-32 sm:px-6 lg:px-8" dir="rtl">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            קבל סרטוני ברכה אישיים <span className="text-gold-500">מהכוכבים האהובים עליך</span>
          </h1>
          <p className="mt-6 text-xl text-gray-300 max-w-3xl">
            הזמן סרטוני ברכה מותאמים אישית לכל אירוע. הפוך את היום של מישהו למיוחד עם ברכה אישית מהכוכב האהוב עליו.
          </p>
          <div className="mt-10 flex space-x-4 space-x-reverse">
            <Link
              to="/explore"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-black bg-gold-500 hover:bg-gold-600"
            >
              גלה יוצרים
            </Link>
            <Link
              to="/categories"
              className="inline-flex items-center px-6 py-3 border border-gold-500 text-base font-medium rounded-md text-gold-500 bg-transparent hover:bg-black-800"
            >
              עיין בקטגוריות
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-gold-500 font-semibold tracking-wide uppercase">איך זה עובד</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-white sm:text-4xl">
              שלושה שלבים פשוטים
            </p>
          </div>

          <div className="mt-20">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-3" dir="rtl">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-md bg-gold-500 text-black">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="mt-6 text-xl font-medium text-white">1. בחר יוצר</h3>
                <p className="mt-2 text-base text-gray-300 text-center">
                  עיין במגוון היוצרים המוכשרים שלנו ומצא את ההתאמה המושלמת להודעת הוידאו שלך.
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-md bg-gold-500 text-black">
                  <Video className="h-8 w-8" />
                </div>
                <h3 className="mt-6 text-xl font-medium text-white">2. בקש סרטון</h3>
                <p className="mt-2 text-base text-gray-300 text-center">
                  ספר לנו על האירוע ומה תרצה שהיוצר יאמר בסרטון המותאם אישית שלך.
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-md bg-gold-500 text-black">
                  <Star className="h-8 w-8" />
                </div>
                <h3 className="mt-6 text-xl font-medium text-white">3. קבל ושתף</h3>
                <p className="mt-2 text-base text-gray-300 text-center">
                  קבל את הסרטון הייחודי שלך לתיבת הדואר ושתף את הקסם עם יקיריך.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="py-12 bg-black-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center mb-12">
            <h2 className="text-base text-gold-500 font-semibold tracking-wide uppercase">קטגוריות</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-white sm:text-4xl">
              מצא את היוצר המושלם
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-300 lg:mx-auto">
              עיין בקטגוריות השונות שלנו ומצא את היוצר המתאים לאירוע שלך
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6" dir="rtl">
            <Link to="/explore?category=musician" className="group">
              <div className="flex flex-col items-center p-6 bg-black-800 rounded-lg border border-gold-500 hover:border-orange-500 transition-colors">
                <div className="text-4xl mb-4">🎵</div>
                <h3 className="text-lg font-medium text-white group-hover:text-gold-400">מוזיקאים</h3>
              </div>
            </Link>
            
            <Link to="/explore?category=actor" className="group">
              <div className="flex flex-col items-center p-6 bg-black-800 rounded-lg border border-gold-500 hover:border-orange-500 transition-colors">
                <div className="text-4xl mb-4">🎭</div>
                <h3 className="text-lg font-medium text-white group-hover:text-gold-400">שחקנים</h3>
              </div>
            </Link>
            
            <Link to="/explore?category=comedian" className="group">
              <div className="flex flex-col items-center p-6 bg-black-800 rounded-lg border border-gold-500 hover:border-orange-500 transition-colors">
                <div className="text-4xl mb-4">😂</div>
                <h3 className="text-lg font-medium text-white group-hover:text-gold-400">קומיקאים</h3>
              </div>
            </Link>
            
            <Link to="/explore?category=influencer" className="group">
              <div className="flex flex-col items-center p-6 bg-black-800 rounded-lg border border-gold-500 hover:border-orange-500 transition-colors">
                <div className="text-4xl mb-4">📱</div>
                <h3 className="text-lg font-medium text-white group-hover:text-gold-400">משפיענים</h3>
              </div>
            </Link>
            
            <Link to="/explore?category=athlete" className="group">
              <div className="flex flex-col items-center p-6 bg-black-800 rounded-lg border border-gold-500 hover:border-orange-500 transition-colors">
                <div className="text-4xl mb-4">⚽</div>
                <h3 className="text-lg font-medium text-white group-hover:text-gold-400">ספורטאים</h3>
              </div>
            </Link>
            
            <Link to="/explore?category=artist" className="group">
              <div className="flex flex-col items-center p-6 bg-black-800 rounded-lg border border-gold-500 hover:border-orange-500 transition-colors">
                <div className="text-4xl mb-4">🎨</div>
                <h3 className="text-lg font-medium text-white group-hover:text-gold-400">אמנים</h3>
              </div>
            </Link>
          </div>
          
          <div className="text-center mt-12">
            <Link
              to="/categories"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-black bg-gold-500 hover:bg-gold-600"
            >
              עיין בכל הקטגוריות
            </Link>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-gold-500 font-semibold tracking-wide uppercase">המלצות</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-white sm:text-4xl">
              מה אומרים עלינו
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3" dir="rtl">
            <div className="bg-black-800 p-6 rounded-lg border border-gold-500">
              <div className="flex items-center mb-4">
                <img
                  className="h-12 w-12 rounded-full object-cover border-2 border-gold-500"
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                  alt="Testimonial"
                />
                <div className="mr-4">
                  <h3 className="text-lg font-medium text-white">שרה לוי</h3>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                  </div>
                </div>
              </div>
              <p className="text-gray-300">
                "הזמנתי סרטון ברכה ליום ההולדת של אבא שלי מהזמר האהוב עליו. הוא היה המום! זו הייתה המתנה המושלמת והוא לא מפסיק לדבר על זה."
              </p>
            </div>

            <div className="bg-black-800 p-6 rounded-lg border border-gold-500">
              <div className="flex items-center mb-4">
                <img
                  className="h-12 w-12 rounded-full object-cover border-2 border-gold-500"
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                  alt="Testimonial"
                />
                <div className="mr-4">
                  <h3 className="text-lg font-medium text-white">דני כהן</h3>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gray-300" />
                  </div>
                </div>
              </div>
              <p className="text-gray-300">
                "הזמנתי סרטון מוטיבציה מספורטאי מפורסם לקבוצת הכדורגל שאני מאמן. הילדים היו בהלם מוחלט והמוטיבציה שלהם עלתה לשמיים!"
              </p>
            </div>

            <div className="bg-black-800 p-6 rounded-lg border border-gold-500">
              <div className="flex items-center mb-4">
                <img
                  className="h-12 w-12 rounded-full object-cover border-2 border-gold-500"
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                  alt="Testimonial"
                />
                <div className="mr-4">
                  <h3 className="text-lg font-medium text-white">מיכל אברהם</h3>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                  </div>
                </div>
              </div>
              <p className="text-gray-300">
                "הזמנתי סרטון הצעת נישואין מהקומיקאית האהובה על בת זוגי. היא צחקה, בכתה ואמרה כן! תודה על שעזרתם לי ליצור רגע בלתי נשכח."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}