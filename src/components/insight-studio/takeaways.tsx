// Takeaways (Takeaways Tab Component)
export function Takeaways({ takeaways }: { takeaways: string[] }) {
  if (takeaways.length === 0)
    return <p className="text-gray-700">No takeaways</p>;

  return (
    <ul>
      {takeaways.map((takeaway) => (
        <li key={takeaway}>{takeaway}</li>
      ))}
    </ul>
  );
}
