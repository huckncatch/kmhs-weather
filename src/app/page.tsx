export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <main className="text-center">
        <h1 className="text-4xl font-bold mb-4">KMHS Weather Dashboard</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Personal weather station data aggregation
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Integrating Ambient Weather, PWS Weather, Weather Underground, and CoCoRaHS
        </p>
      </main>
    </div>
  );
}
