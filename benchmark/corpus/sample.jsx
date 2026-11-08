const App = ({ title, items }) => (
  <main className="app">
    <h1>{title}</h1>
    <ul>
      {items.map((item) => (
        <li key={item.id} data-id={item.id}>
          {item.label}
        </li>
      ))}
    </ul>
  </main>
);

export default App;
