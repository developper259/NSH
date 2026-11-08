interface Props {
  title: string;
  items: Array<{ id: number; label: string }>;
}

const App = ({ title, items }: Props) => (
  <main className="app">
    <h1>{title as string}</h1>
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  </main>
);

export default App;
