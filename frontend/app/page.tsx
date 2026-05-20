import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative isolate overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:pt-40">
        <div className="mx-auto max-w-2xl shrink-0 lg:mx-0 lg:max-w-xl lg:pt-8">
          <div className="mt-24 sm:mt-32 lg:mt-16">
            <a href="#" className="inline-flex space-x-6">
              <span className="rounded-full bg-blue-600/10 px-3 py-1 text-sm font-semibold leading-6 text-blue-600 ring-1 ring-inset ring-blue-600/10">
                Нове в MedQueue
              </span>
              <span className="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-slate-600">
                <span>Версія 1.0 вже доступна</span>
                <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </span>
            </a>
          </div>
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Управляйте медичною чергою <span className="text-blue-600">розумно</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            MedQueue допомагає клінікам автоматизувати запис пацієнтів, керувати живою чергою та зменшувати час очікування. Сучасне рішення для сучасних медичних центрів.
          </p>
          <div className="mt-10 flex items-center gap-x-6">
            <Link
              href="/book"
              className="rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-500 hover:shadow-xl active:scale-95"
            >
              Записатись на прийом
            </Link>
            <Link href="/dashboard" className="text-sm font-semibold leading-6 text-slate-900 hover:text-blue-600 transition-colors">
              Переглянути чергу <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        
        <div className="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mr-0 lg:mt-0 lg:max-w-none lg:flex-none xl:ml-32">
          <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
            <div className="rounded-2xl bg-slate-900/5 p-2 ring-1 ring-inset ring-slate-900/10 lg:-m-4 lg:rounded-3xl lg:p-4">
              <div className="w-[48rem] rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10 sm:w-[57rem] overflow-hidden">
                {/* Mockup of the dashboard */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="mx-auto bg-white border border-slate-200 rounded px-4 py-0.5 text-[10px] text-slate-400">
                    medqueue.com/dashboard
                  </div>
                </div>
                <div className="p-8">
                   <div className="flex justify-between items-center mb-8">
                      <div className="h-8 w-32 bg-slate-100 rounded animate-pulse" />
                      <div className="h-8 w-8 bg-slate-100 rounded-full animate-pulse" />
                   </div>
                   <div className="grid grid-cols-3 gap-6">
                      <div className="col-span-2 h-64 bg-slate-50 rounded-xl animate-pulse" />
                      <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
