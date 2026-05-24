import React, { useMemo, useState } from "react";
import { Package, Users, UserCog, ArrowUpRight, RefreshCcw, Plus, Search, Trash2, Edit3, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export default function SistemaControleEstoque() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [search, setSearch] = useState("");

  const [produtos, setProdutos] = useState([
    { id: 1, nome: "Camiseta Premium", codigo: "CAM-001", categoria: "Roupas", quantidade: 35, minimo: 10, preco: 59.9 },
    { id: 2, nome: "Boné Aba Curva", codigo: "BON-002", categoria: "Acessórios", quantidade: 8, minimo: 12, preco: 39.9 },
    { id: 3, nome: "Tênis Casual", codigo: "TEN-003", categoria: "Calçados", quantidade: 14, minimo: 5, preco: 189.9 },
  ]);

  const [clientes, setClientes] = useState([
    { id: 1, nome: "João Silva", telefone: "(21) 99999-0001", email: "joao@email.com", cpf: "000.000.000-00" },
    { id: 2, nome: "Maria Souza", telefone: "(21) 98888-0002", email: "maria@email.com", cpf: "111.111.111-11" },
  ]);

  const [funcionarios, setFuncionarios] = useState([
    { id: 1, nome: "Carlos Pereira", cargo: "Vendedor", telefone: "(21) 97777-0003", status: "Ativo" },
    { id: 2, nome: "Ana Lima", cargo: "Gerente", telefone: "(21) 96666-0004", status: "Ativo" },
  ]);

  const [saidas, setSaidas] = useState([
    { id: 1, produto: "Camiseta Premium", cliente: "João Silva", funcionario: "Carlos Pereira", quantidade: 2, data: "2026-05-19", tipo: "Venda" },
  ]);

  const [trocas, setTrocas] = useState([
    { id: 1, cliente: "Maria Souza", produtoAntigo: "Boné Aba Curva", produtoNovo: "Camiseta Premium", motivo: "Tamanho/Modelo", status: "Concluída" },
  ]);

  const [formProduto, setFormProduto] = useState({ nome: "", codigo: "", categoria: "", quantidade: "", minimo: "", preco: "" });
  const [formCliente, setFormCliente] = useState({ nome: "", telefone: "", email: "", cpf: "" });
  const [formFuncionario, setFormFuncionario] = useState({ nome: "", cargo: "", telefone: "", status: "Ativo" });
  const [formSaida, setFormSaida] = useState({ produto: "", cliente: "", funcionario: "", quantidade: "", tipo: "Venda" });
  const [formTroca, setFormTroca] = useState({ cliente: "", produtoAntigo: "", produtoNovo: "", motivo: "", status: "Pendente" });

  const dashboard = useMemo(() => {
    const totalProdutos = produtos.length;
    const baixoEstoque = produtos.filter((p) => Number(p.quantidade) <= Number(p.minimo)).length;
    const valorEstoque = produtos.reduce((acc, p) => acc + Number(p.quantidade) * Number(p.preco), 0);
    return { totalProdutos, baixoEstoque, valorEstoque, clientes: clientes.length, funcionarios: funcionarios.length, saidas: saidas.length, trocas: trocas.length };
  }, [produtos, clientes, funcionarios, saidas, trocas]);

  function addProduto(e) {
    e.preventDefault();
    if (!formProduto.nome || !formProduto.codigo) return;
    setProdutos([...produtos, { id: Date.now(), ...formProduto, quantidade: Number(formProduto.quantidade || 0), minimo: Number(formProduto.minimo || 0), preco: Number(formProduto.preco || 0) }]);
    setFormProduto({ nome: "", codigo: "", categoria: "", quantidade: "", minimo: "", preco: "" });
  }

  function addCliente(e) {
    e.preventDefault();
    if (!formCliente.nome) return;
    setClientes([...clientes, { id: Date.now(), ...formCliente }]);
    setFormCliente({ nome: "", telefone: "", email: "", cpf: "" });
  }

  function addFuncionario(e) {
    e.preventDefault();
    if (!formFuncionario.nome) return;
    setFuncionarios([...funcionarios, { id: Date.now(), ...formFuncionario }]);
    setFormFuncionario({ nome: "", cargo: "", telefone: "", status: "Ativo" });
  }

  function addSaida(e) {
    e.preventDefault();
    if (!formSaida.produto || !formSaida.quantidade) return;
    const quantidadeSaida = Number(formSaida.quantidade || 0);
    setProdutos(produtos.map((p) => p.nome === formSaida.produto ? { ...p, quantidade: Math.max(0, Number(p.quantidade) - quantidadeSaida) } : p));
    setSaidas([...saidas, { id: Date.now(), ...formSaida, quantidade: quantidadeSaida, data: new Date().toISOString().slice(0, 10) }]);
    setFormSaida({ produto: "", cliente: "", funcionario: "", quantidade: "", tipo: "Venda" });
  }

  function addTroca(e) {
    e.preventDefault();
    if (!formTroca.cliente || !formTroca.produtoAntigo || !formTroca.produtoNovo) return;
    setTrocas([...trocas, { id: Date.now(), ...formTroca }]);
    setFormTroca({ cliente: "", produtoAntigo: "", produtoNovo: "", motivo: "", status: "Pendente" });
  }

  function removeItem(setter, lista, id) {
    setter(lista.filter((item) => item.id !== id));
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "saidas", label: "Saídas", icon: ArrowUpRight },
    { id: "funcionarios", label: "Funcionários", icon: UserCog },
    { id: "trocas", label: "Trocas", icon: RefreshCcw },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Sistema de Controle</h1>
            <p className="text-slate-600 mt-1">Estoque, clientes, saídas, funcionários e trocas.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar..." className="w-full pl-10 pr-4 py-2 rounded-2xl bg-white shadow-sm outline-none border border-slate-200" />
          </div>
        </header>

        <nav className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-2xl p-3 flex items-center justify-center gap-2 font-medium shadow-sm transition ${activeTab === tab.id ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"}`}>
                <Icon size={18} /> {tab.label}
              </button>
            );
          })}
        </nav>

        <motion.main key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "dashboard" && <Dashboard data={dashboard} produtos={produtos} />}
          {activeTab === "estoque" && <Estoque produtos={produtos} search={search} form={formProduto} setForm={setFormProduto} add={addProduto} remove={(id) => removeItem(setProdutos, produtos, id)} />}
          {activeTab === "clientes" && <Clientes clientes={clientes} search={search} form={formCliente} setForm={setFormCliente} add={addCliente} remove={(id) => removeItem(setClientes, clientes, id)} />}
          {activeTab === "saidas" && <Saidas saidas={saidas} produtos={produtos} clientes={clientes} funcionarios={funcionarios} form={formSaida} setForm={setFormSaida} add={addSaida} />}
          {activeTab === "funcionarios" && <Funcionarios funcionarios={funcionarios} search={search} form={formFuncionario} setForm={setFormFuncionario} add={addFuncionario} remove={(id) => removeItem(setFuncionarios, funcionarios, id)} />}
          {activeTab === "trocas" && <Trocas trocas={trocas} clientes={clientes} produtos={produtos} form={formTroca} setForm={setFormTroca} add={addTroca} />}
        </motion.main>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-5 ${className}`}>{children}</div>;
}

function Field({ label, children }) {
  return <label className="block"><span className="text-sm font-medium text-slate-600">{label}</span>{children}</label>;
}

function Input(props) {
  return <input {...props} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" />;
}

function Select(props) {
  return <select {...props} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 bg-white" />;
}

function AddButton() {
  return <button className="rounded-xl bg-slate-900 text-white px-4 py-2 flex items-center gap-2 hover:bg-slate-800"><Plus size={18} />Adicionar</button>;
}

function Dashboard({ data, produtos }) {
  const cards = [
    ["Produtos cadastrados", data.totalProdutos],
    ["Clientes", data.clientes],
    ["Funcionários", data.funcionarios],
    ["Saídas registradas", data.saidas],
    ["Trocas", data.trocas],
    ["Baixo estoque", data.baixoEstoque],
  ];
  return <div className="grid md:grid-cols-3 gap-4">
    {cards.map(([label, value]) => <Card key={label}><p className="text-slate-500 text-sm">{label}</p><h2 className="text-3xl font-bold mt-2">{value}</h2></Card>)}
    <Card className="md:col-span-3">
      <p className="text-slate-500 text-sm">Valor estimado em estoque</p>
      <h2 className="text-4xl font-bold mt-2">R$ {data.valorEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h2>
    </Card>
    <Card className="md:col-span-3">
      <h3 className="font-bold mb-3">Produtos com atenção</h3>
      <div className="grid gap-2">
        {produtos.filter(p => p.quantidade <= p.minimo).map(p => <div key={p.id} className="p-3 rounded-xl bg-slate-100 flex justify-between"><span>{p.nome}</span><strong>{p.quantidade} unidades</strong></div>)}
        {produtos.filter(p => p.quantidade <= p.minimo).length === 0 && <p className="text-slate-500">Nenhum produto abaixo do mínimo.</p>}
      </div>
    </Card>
  </div>;
}

function Estoque({ produtos, search, form, setForm, add, remove }) {
  const filtered = produtos.filter(p => JSON.stringify(p).toLowerCase().includes(search.toLowerCase()));
  return <div className="grid lg:grid-cols-3 gap-4"><Card><h2 className="font-bold text-xl mb-4">Cadastrar produto</h2><form onSubmit={add} className="grid gap-3"><Field label="Nome"><Input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></Field><Field label="Código"><Input value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value})}/></Field><Field label="Categoria"><Input value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}/></Field><Field label="Quantidade"><Input type="number" value={form.quantidade} onChange={e=>setForm({...form,quantidade:e.target.value})}/></Field><Field label="Estoque mínimo"><Input type="number" value={form.minimo} onChange={e=>setForm({...form,minimo:e.target.value})}/></Field><Field label="Preço"><Input type="number" step="0.01" value={form.preco} onChange={e=>setForm({...form,preco:e.target.value})}/></Field><AddButton /></form></Card><Card className="lg:col-span-2 overflow-auto"><h2 className="font-bold text-xl mb-4">Estoque</h2><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2">Produto</th><th>Código</th><th>Qtd.</th><th>Preço</th><th></th></tr></thead><tbody>{filtered.map(p=><tr key={p.id} className="border-b"><td className="py-3 font-medium">{p.nome}<br/><span className="text-slate-500">{p.categoria}</span></td><td>{p.codigo}</td><td><span className={p.quantidade <= p.minimo ? "font-bold text-red-600" : ""}>{p.quantidade}</span></td><td>R$ {Number(p.preco).toFixed(2)}</td><td><button onClick={()=>remove(p.id)}><Trash2 size={17}/></button></td></tr>)}</tbody></table></Card></div>;
}

function Clientes({ clientes, search, form, setForm, add, remove }) {
  const filtered = clientes.filter(c => JSON.stringify(c).toLowerCase().includes(search.toLowerCase()));
  return <div className="grid lg:grid-cols-3 gap-4"><Card><h2 className="font-bold text-xl mb-4">Cadastrar cliente</h2><form onSubmit={add} className="grid gap-3"><Field label="Nome"><Input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></Field><Field label="Telefone"><Input value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})}/></Field><Field label="E-mail"><Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="CPF"><Input value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})}/></Field><AddButton /></form></Card><Card className="lg:col-span-2"><h2 className="font-bold text-xl mb-4">Clientes</h2><div className="grid gap-3">{filtered.map(c=><div key={c.id} className="p-4 rounded-xl bg-slate-100 flex justify-between"><div><strong>{c.nome}</strong><p className="text-sm text-slate-600">{c.telefone} • {c.email}</p><p className="text-sm text-slate-500">CPF: {c.cpf}</p></div><button onClick={()=>remove(c.id)}><Trash2 size={17}/></button></div>)}</div></Card></div>;
}

function Funcionarios({ funcionarios, search, form, setForm, add, remove }) {
  const filtered = funcionarios.filter(f => JSON.stringify(f).toLowerCase().includes(search.toLowerCase()));
  return <div className="grid lg:grid-cols-3 gap-4"><Card><h2 className="font-bold text-xl mb-4">Cadastrar funcionário</h2><form onSubmit={add} className="grid gap-3"><Field label="Nome"><Input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></Field><Field label="Cargo"><Input value={form.cargo} onChange={e=>setForm({...form,cargo:e.target.value})}/></Field><Field label="Telefone"><Input value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})}/></Field><Field label="Status"><Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Ativo</option><option>Inativo</option></Select></Field><AddButton /></form></Card><Card className="lg:col-span-2"><h2 className="font-bold text-xl mb-4">Funcionários</h2><div className="grid gap-3">{filtered.map(f=><div key={f.id} className="p-4 rounded-xl bg-slate-100 flex justify-between"><div><strong>{f.nome}</strong><p className="text-sm text-slate-600">{f.cargo} • {f.telefone}</p><p className="text-sm text-slate-500">Status: {f.status}</p></div><button onClick={()=>remove(f.id)}><Trash2 size={17}/></button></div>)}</div></Card></div>;
}

function Saidas({ saidas, produtos, clientes, funcionarios, form, setForm, add }) {
  return <div className="grid lg:grid-cols-3 gap-4"><Card><h2 className="font-bold text-xl mb-4">Registrar saída</h2><form onSubmit={add} className="grid gap-3"><Field label="Produto"><Select value={form.produto} onChange={e=>setForm({...form,produto:e.target.value})}><option value="">Selecione</option>{produtos.map(p=><option key={p.id}>{p.nome}</option>)}</Select></Field><Field label="Cliente"><Select value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})}><option value="">Selecione</option>{clientes.map(c=><option key={c.id}>{c.nome}</option>)}</Select></Field><Field label="Funcionário"><Select value={form.funcionario} onChange={e=>setForm({...form,funcionario:e.target.value})}><option value="">Selecione</option>{funcionarios.map(f=><option key={f.id}>{f.nome}</option>)}</Select></Field><Field label="Quantidade"><Input type="number" value={form.quantidade} onChange={e=>setForm({...form,quantidade:e.target.value})}/></Field><Field label="Tipo"><Select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}><option>Venda</option><option>Uso interno</option><option>Perda</option><option>Brinde</option></Select></Field><AddButton /></form></Card><Card className="lg:col-span-2"><h2 className="font-bold text-xl mb-4">Histórico de saídas</h2><div className="grid gap-3">{saidas.map(s=><div key={s.id} className="p-4 rounded-xl bg-slate-100"><strong>{s.produto}</strong><p className="text-sm text-slate-600">Qtd: {s.quantidade} • {s.tipo} • {s.data}</p><p className="text-sm text-slate-500">Cliente: {s.cliente || "Não informado"} • Funcionário: {s.funcionario || "Não informado"}</p></div>)}</div></Card></div>;
}

function Trocas({ trocas, clientes, produtos, form, setForm, add }) {
  return <div className="grid lg:grid-cols-3 gap-4"><Card><h2 className="font-bold text-xl mb-4">Registrar troca</h2><form onSubmit={add} className="grid gap-3"><Field label="Cliente"><Select value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})}><option value="">Selecione</option>{clientes.map(c=><option key={c.id}>{c.nome}</option>)}</Select></Field><Field label="Produto devolvido"><Select value={form.produtoAntigo} onChange={e=>setForm({...form,produtoAntigo:e.target.value})}><option value="">Selecione</option>{produtos.map(p=><option key={p.id}>{p.nome}</option>)}</Select></Field><Field label="Produto novo"><Select value={form.produtoNovo} onChange={e=>setForm({...form,produtoNovo:e.target.value})}><option value="">Selecione</option>{produtos.map(p=><option key={p.id}>{p.nome}</option>)}</Select></Field><Field label="Motivo"><Input value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})}/></Field><Field label="Status"><Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Pendente</option><option>Concluída</option><option>Cancelada</option></Select></Field><AddButton /></form></Card><Card className="lg:col-span-2"><h2 className="font-bold text-xl mb-4">Histórico de trocas</h2><div className="grid gap-3">{trocas.map(t=><div key={t.id} className="p-4 rounded-xl bg-slate-100"><strong>{t.cliente}</strong><p className="text-sm text-slate-600">Devolveu: {t.produtoAntigo}</p><p className="text-sm text-slate-600">Recebeu: {t.produtoNovo}</p><p className="text-sm text-slate-500">Motivo: {t.motivo} • Status: {t.status}</p></div>)}</div></Card></div>;
}
