"use client";

import React, { useEffect, useState } from "react";

interface Report {
  id: string;
  topic: string;
  created_at: string;
  plan: string;
}

export default function LibraryPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/history");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setReports(data);
      } catch (e: any) {
        setError(e.message);
        // Fallback data for demonstration if backend is not up yet
        console.warn("Backend not reachable, showing fallback data", e);
        setReports([
          { id: "1", topic: "AI Trends 2026", created_at: "2026-05-23T10:00:00Z", plan: "Analyze recent papers" },
          { id: "2", topic: "Quantum Computing Advances", created_at: "2026-05-22T14:30:00Z", plan: "Review hardware progress" }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-4">
            Advanced Research Library
          </h1>
          <p className="text-gray-400 text-lg">Explore historical research reports and plans</p>
        </header>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-purple-500/20 hover:-translate-y-1 transition-all duration-300 border border-gray-700 hover:border-purple-500/50 flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-white line-clamp-2">{report.topic}</h2>
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex-grow flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">Plan</h3>
                        <p className="text-gray-300 text-sm line-clamp-3 mb-4">{report.plan}</p>
                    </div>
                    <button className="w-full mt-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50">
                        View Full Report
                    </button>
                </div>
              </div>
            ))}
            
            {reports.length === 0 && !error && (
                <div className="col-span-full text-center py-12">
                    <p className="text-gray-400 text-lg">No research reports found.</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
