"use client";
import Image from "next/image";

type ErrorProps = {
  onRetry?: () => void;
};

export default function Error({ onRetry }: ErrorProps) {
  const handleRetry = () => {
    if (onRetry) return onRetry();
    // Default behavior for production usage
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <Image src="/logo.png" alt="Error" width={200} height={200} />
      <h2 className="text-2xl font-bold text-slate-800 my-4">
        Something went wrong!
      </h2>
      <button
        className="px-4 py-2 bg-slate-500 text-black rounded hover:bg-slate-700"
        onClick={handleRetry}
      >
        Try again
      </button>
    </div>
  );
}
