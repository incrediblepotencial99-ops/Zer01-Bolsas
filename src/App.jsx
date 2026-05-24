import React, { useEffect, useState, useMemo } from "react";
import { 
  Package, Users, UserCog, ArrowUpRight, RefreshCcw, Plus, Search, 
  Trash2, LogOut, Camera, QrCode, Sparkles, Percent, BarChart3, 
  Menu, X, Check, ShoppingCart, UserCheck, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { createWorker } from "tesseract.js";
import { gerarRelatorioHtml } from "./relatorioTemplate";

const getSaudacao = () => {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
};

const getDataFormatada = () => {
  const opcoes = { weekday: "long", day: "numeric", month: "long" };
  const dataStr = new Date().toLocaleDateString("pt-BR", opcoes);
  return dataStr.charAt(0).toUpperCase() + dataStr.slice(1);
};

export default function App() {
  // Session & Authentication
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [hasNoUsers, setHasNoUsers] = useState(false);

  // Form states for login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [authError, setAuthError] = useState("");

  // Navigation
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [highlightedExchangeId, setHighlightedExchangeId] = useState(null);

  // Calendário Faturamento
  const [dataSelecionada, setDataSelecionada] = useState(() => new Date());
  const [mesAnoExibido, setMesAnoExibido] = useState(() => new Date());

  // Dashboard Interactive States
  const [dashboardDateFilter, setDashboardDateFilter] = useState(() => new Date());
  const [dashboardVendedorFilter, setDashboardVendedorFilter] = useState("all");
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // App Data State
  const [bolsas, setBolsas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [trocas, setTrocas] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  
  // Search and filters
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'grid'
  const [searchQuery, setSearchQuery] = useState("");
  const [searchQueryClientes, setSearchQueryClientes] = useState("");
  const [filterMarca, setFilterMarca] = useState("");
  const [filterCor, setFilterCor] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDesconto, setFilterDesconto] = useState("all");

  // Camera & Scanner Modal States
  const [showScanner, setShowScanner] = useState(false);
  const [cameraUploading, setCameraUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Form states for entities
  const [formBolsa, setFormBolsa] = useState({
    codigo: "", nome: "", marca: "", cor: "", tamanho: "", 
    material: "", foto_url: "", preco_custo: "", preco_venda: "", 
    preco_desconto: "", desconto_ativo: false, quantidade: 1, quantidade_minima: 2
  });
  
  const [formCliente, setFormCliente] = useState({
    nome: "", telefone: "", email: "", cpf: ""
  });
  
  const [editingCliente, setEditingCliente] = useState(null);
  const [editingBolsa, setEditingBolsa] = useState(null);
  const [selectedBolsaForView, setSelectedBolsaForView] = useState(null);
  const [selectedClienteForHistory, setSelectedClienteForHistory] = useState(null);
  
  const [formVenda, setFormVenda] = useState({
    bolsa_id: "", cliente_id: "", preco_vendido: "", observacao: "", forma_pagamento: "dinheiro", funcionario_id: ""
  });

  const [cart, setCart] = useState([]);
  const [descontoVenda, setDescontoVenda] = useState(""); // Desconto manual em R$
  const [buscaCodigoVenda, setBuscaCodigoVenda] = useState("");

  const handleAdicionarPorCodigo = () => {
    const cod = buscaCodigoVenda.trim().toUpperCase();
    if (!cod) return;
    const bolsaEncontrada = bolsas.find(b => b.codigo && b.codigo.trim().toUpperCase() === cod);
    if (!bolsaEncontrada) {
      alert(`Produto com o código "${cod}" não encontrado no estoque.`);
      return;
    }
    if (bolsaEncontrada.quantidade <= 0) {
      alert(`Produto "${bolsaEncontrada.nome}" (${cod}) está sem estoque!`);
      return;
    }
    addToCart(bolsaEncontrada.id);
    setBuscaCodigoVenda("");
  };

  const handleKeyDownCodigo = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdicionarPorCodigo();
    }
  };

  const addToCart = (bolsaId) => {
    if (!bolsaId) return;
    const bolsa = bolsas.find(b => b.id === bolsaId);
    if (!bolsa) return;
    
    if (bolsa.quantidade <= 0) {
      alert("Este produto está sem estoque disponível!");
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.id === bolsaId);
      if (existing) {
        if (existing.qty >= bolsa.quantidade) {
          alert(`Quantidade máxima em estoque atingida para ${bolsa.nome} (${bolsa.quantidade} un).`);
          return prev;
        }
        return prev.map(item => item.id === bolsaId ? { ...item, qty: item.qty + 1 } : item);
      } else {
        return [...prev, {
          id: bolsa.id,
          nome: bolsa.nome,
          codigo: bolsa.codigo,
          foto_url: bolsa.foto_url,
          preco_venda: Number(bolsa.preco_venda),
          preco_desconto: bolsa.preco_desconto ? Number(bolsa.preco_desconto) : null,
          desconto_ativo: bolsa.desconto_ativo,
          stock: bolsa.quantidade,
          qty: 1
        }];
      }
    });
  };

  const updateCartQty = (bolsaId, delta) => {
    setCart(prev => {
      const item = prev.find(i => i.id === bolsaId);
      if (!item) return prev;
      
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        return prev.filter(i => i.id !== bolsaId);
      }
      
      if (newQty > item.stock) {
        alert(`Quantidade máxima em estoque atingida (${item.stock} un).`);
        return prev;
      }
      
      return prev.map(i => i.id === bolsaId ? { ...i, qty: newQty } : i);
    });
  };

  const removeFromCart = (bolsaId) => {
    setCart(prev => prev.filter(i => i.id !== bolsaId));
  };

  const [formTroca, setFormTroca] = useState({
    cliente_id: "", venda_id: "", bolsa_devolvida_id: "", bolsa_nova_id: "", motivo: "", forma_pagamento: "pix", desconto_novo: 0
  });
  const [codigoDevolvido, setCodigoDevolvido] = useState("");
  const [codigoNovo, setCodigoNovo] = useState("");
  const [feedbackDevolvido, setFeedbackDevolvido] = useState(null);
  const [feedbackNovo, setFeedbackNovo] = useState(null);

  const [formFuncionario, setFormFuncionario] = useState({
    email: "", password: "", nome: "", role: "funcionario", telefone: ""
  });

  const [editingFuncionario, setEditingFuncionario] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Helper robusto para formatar data local como YYYY-MM-DD
  const formatLocalDate = (dateObj) => {
    const ano = dateObj.getFullYear();
    const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dateObj.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const getLocalDateStr = (dateInput) => {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const [relatorioDataInicio, setRelatorioDataInicio] = useState(() => {
    const d = new Date();
    return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [relatorioDataFim, setRelatorioDataFim] = useState(() => {
    return formatLocalDate(new Date());
  });

  const [dashboardDataInicio, setDashboardDataInicio] = useState(() => {
    const d = new Date();
    return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [dashboardDataFim, setDashboardDataFim] = useState(() => {
    return formatLocalDate(new Date());
  });

  // Datas de referência para filtros rápidos locais
  const hojeStr = formatLocalDate(new Date());
  const ontemStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  })();
  const inicioMesStr = (() => {
    const d = new Date();
    return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
  })();
  const seteDiasStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatLocalDate(d);
  })();

  // Handle ESC key to close product view modal and client history modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedBolsaForView(null);
        setSelectedClienteForHistory(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen to Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id, session.user.email);
      } else {
        setAuthLoading(false);
        checkIfSystemHasUsers();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id, session.user.email);
      } else {
        setProfile(null);
        setAuthLoading(false);
        checkIfSystemHasUsers();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch all app data when logged in
  useEffect(() => {
    if (session && profile) {
      loadAllData();
    }
  }, [session, profile]);

  const checkIfSystemHasUsers = async () => {
    try {
      const { data: hasUsers, error } = await supabase
        .rpc("system_has_users");
      if (!error && hasUsers === false) {
        setHasNoUsers(true);
        setIsSignUp(true); // Default to sign up for first user
      } else {
        setHasNoUsers(false);
      }
    } catch (e) {
      console.error(e);
      setHasNoUsers(false);
    }
  };

  const fetchUserProfile = async (userId, userEmail) => {
    try {
      setAuthLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        // Fallback profile if user was created in Auth but not in profiles yet
        setProfile({ id: userId, nome: userEmail, role: "funcionario" });
      } else {
        setProfile(data);
        if (data.role === "funcionario" && ["dashboard", "descontos", "funcionarios", "relatorios"].includes(activeTab)) {
          setActiveTab("estoque"); // Employees start on stock tab
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadAllData = async () => {
    setDataLoading(true);
    try {
      // 1. Fetch Bolsas
      const { data: bData } = await supabase.from("bolsas").select("*").order("created_at", { ascending: false });
      setBolsas(bData || []);

      // 2. Fetch Clientes
      const { data: cData } = await supabase.from("clientes").select("*").order("nome");
      setClientes(cData || []);

      // 3. Fetch Funcionarios (Profiles)
      const { data: fData } = await supabase.from("profiles").select("*").order("nome");
      setFuncionarios(fData || []);

      // 4. Fetch Vendas
      const { data: vData } = await supabase.from("vendas").select("*, bolsas(nome, codigo), clientes(nome), profiles(nome)").order("created_at", { ascending: false });
      setVendas(vData || []);

      // 5. Fetch Trocas
      const { data: tData } = await supabase.from("trocas").select("*, clientes(nome), devolvida:bolsas!bolsa_devolvida_id(nome, codigo), nova:bolsas!bolsa_nova_id(nome, codigo)").order("created_at", { ascending: false });
      setTrocas(tData || []);

      // 6. Fetch Entradas de Estoque
      const { data: eData } = await supabase.from("entradas").select("*, bolsas(nome, codigo), profiles:funcionario_id(nome)").order("created_at", { ascending: false });
      setEntradas(eData || []);
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setDataLoading(false);
    }
  };

  // Auth Operations
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message || "Erro ao fazer login. Verifique seus dados.");
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!hasNoUsers) {
      setAuthError("O cadastro de novos usuários está desativado. Solicite ao administrador do sistema para cadastrar sua conta.");
      setAuthLoading(false);
      return;
    }
    setAuthError("");
    setAuthLoading(true);
    try {
      // Register user in auth with metadata for the database trigger
      const { data: authData, error: authErr } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            nome: nome,
            telefone: telefone,
            role: hasNoUsers ? "admin" : "funcionario"
          }
        }
      });
      if (authErr) throw authErr;

      if (authData.user) {
        setHasNoUsers(false);
        if (authData.session) {
          alert("Conta criada e logada com sucesso!");
        } else {
          alert("Conta criada com sucesso! Se a confirmação de e-mail estiver ativada na sua instância do Supabase, verifique sua caixa de entrada para ativar a conta. Em seguida, faça o login.");
          setIsSignUp(false); // Move to login tab
        }
      }
    } catch (err) {
      setAuthError(err.message || "Erro ao criar conta.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  // Image Upload logic (capture image via file inputs)
  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCameraUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `bolsas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('bolsas-fotos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bolsas-fotos')
        .getPublicUrl(filePath);

      setFormBolsa(prev => ({ ...prev, foto_url: publicUrl }));
      
      // Perform OCR automatically
      runOCR(file);
    } catch (err) {
      alert("Erro no upload da foto: " + err.message);
    } finally {
      setCameraUploading(false);
    }
  };

  // Tesseract OCR implementation
  const runOCR = async (file) => {
    setOcrLoading(true);
    try {
      const worker = await createWorker("por"); // Portuguese
      const ret = await worker.recognize(file);
      await worker.terminate();
      
      // Extract alphanumeric string that looks like a product code
      const text = ret.data.text;
      const codes = text.match(/[A-Z0-9-]{4,12}/i);
      
      if (codes && codes[0]) {
        setFormBolsa(prev => ({ ...prev, codigo: codes[0].toUpperCase() }));
        alert(`Código de etiqueta detectado por OCR: ${codes[0].toUpperCase()}`);
      } else {
        alert("Não foi possível detectar um padrão de código nítido. O texto extraído foi: " + text.substring(0, 100));
      }
    } catch (err) {
      console.error(err);
      alert("Falha no OCR: " + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  // Barcode / QR Scanner using html5-qrcode
  const startScanner = () => {
    setShowScanner(true);
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode("reader");
      const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        setFormBolsa(prev => ({ ...prev, codigo: decodedText }));
        html5QrCode.stop().then(() => {
          setShowScanner(false);
          alert("Código escaneado com sucesso: " + decodedText);
        }).catch(err => console.error(err));
      };
      
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      html5QrCode.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback
      ).catch(err => {
        console.error(err);
        alert("Erro ao iniciar câmera para escaneamento: " + err.message);
        setShowScanner(false);
      });
    }, 200);
  };

  // Helper to show custom premium toast notification
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  // Export Dashboard sales to CSV
  const handleExportDashboard = () => {
    let filteredSales = dashboardVendasFiltradas;
    if (dashboardVendedorFilter && dashboardVendedorFilter !== "all") {
      filteredSales = filteredSales.filter(v => v.funcionario_id === dashboardVendedorFilter);
    }
    
    if (filteredSales.length === 0) {
      triggerToast("Nenhuma venda neste período para exportar.");
      return;
    }
    
    // Gerar CSV com cabeçalhos e codificação correta
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "ID da Venda;Bolsa;Cód Bolsa;Vendedor;Preço Vendido;Teve Desconto;Valor Desconto;Data;Observação\n";
    
    filteredSales.forEach(v => {
      const dataVenda = new Date(v.created_at || v.data).toLocaleString("pt-BR");
      const linha = [
        v.id,
        v.bolsas?.nome || "Produto Excluído",
        v.bolsas?.codigo || "-",
        funcionarios.find(f => f.id === v.funcionario_id)?.nome || v.profiles?.nome || "Sistema",
        `R$ ${Number(v.preco_vendido).toFixed(2)}`,
        v.tinha_desconto ? "Sim" : "Não",
        `R$ ${Number(v.desconto_valor || 0).toFixed(2)}`,
        dataVenda,
        v.observacao || ""
      ].map(campo => `"${campo.toString().replace(/"/g, '""')}"`).join(";");
      csvContent += linha + "\n";
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    // Nome amigável do arquivo baseado no período
    const periodoSlug = dashboardPeriodoInfo.label.toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .trim();
    
    link.setAttribute("download", `Vendas_Zero1Bags_${periodoSlug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    triggerToast(`Relatório de vendas exportado com sucesso! (${filteredSales.length} registros)`);
  };

  // Share Dashboard Summary (copies to clipboard)
  const handleShareDashboard = () => {
    const periodoFormatado = dashboardPeriodoInfo.label.toUpperCase();
    const totalFaturado = dashboardStats.totalFaturadoMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const qtdVendas = dashboardStats.qtdVendasMes;
    
    let vendedorNome = "Todos os Vendedores";
    if (dashboardVendedorFilter !== "all") {
      const f = funcionarios.find(func => func.id === dashboardVendedorFilter);
      if (f) vendedorNome = f.nome;
    }

    const textoResumo = 
`📊 *ZERO 1 BAGS - RESUMO FINANCEIRO* 📊
📅 Período: ${periodoFormatado}
👥 Filtro: ${vendedorNome}
💰 Faturamento Bruto: ${totalFaturado}
🛍️ Quantidade de Vendas: ${qtdVendas} unidades
⭐ Gerado em: ${new Date().toLocaleString("pt-BR")}
🔗 Sistema Zero 1 Bags`;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textoResumo).then(() => {
        triggerToast("Resumo copiado para a área de transferência!");
      }).catch(err => {
        console.error(err);
        triggerToast("Erro ao copiar resumo.");
      });
    } else {
      // Fallback for non-HTTPS (mobile via local IP)
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textoResumo;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        triggerToast("Resumo copiado para a área de transferência!");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleImprimirRelatorio = () => {
    const dataInicioFmt = relatorioDataInicio ? new Date(relatorioDataInicio + "T12:00:00").toLocaleDateString("pt-BR") : "—";
    const dataFimFmt = relatorioDataFim ? new Date(relatorioDataFim + "T12:00:00").toLocaleDateString("pt-BR") : "—";
    
    const hojeData = new Date();
    const diaFmt = String(hojeData.getDate()).padStart(2, '0');
    const mesFmt = String(hojeData.getMonth() + 1).padStart(2, '0');
    const anoFmt = hojeData.getFullYear();
    const horaFmt = String(hojeData.getHours()).padStart(2, '0');
    const minFmt = String(hojeData.getMinutes()).padStart(2, '0');
    const nomeArquivo = `Relatorio_Zero1_${diaFmt}-${mesFmt}-${anoFmt}_${horaFmt}${minFmt}`;
    const dataHoraGeracao = `${diaFmt}/${mesFmt}/${anoFmt} às ${horaFmt}:${minFmt}`;

    const operadorNome = profile?.nome || "Administrador";
    const operadorCargo = profile?.role === "admin" ? "Administrador" : "Colaborador";
    
    // Vendas de hoje reais (data atual local)
    const hojeStrLocal = getLocalDateStr(new Date());
    const vendasHoje = vendas.filter(v => getLocalDateStr(v.created_at) === hojeStrLocal);
    const faturamentoHoje = vendasHoje.reduce((acc, v) => acc + (Number(v.preco_vendido) || 0), 0);
    const qtdHoje = vendasHoje.length;

    // Métricas de estoque atuais (preço de venda)
    const totalEstoqueItens = bolsas.reduce((acc, b) => acc + (b.quantidade > 0 ? b.quantidade : 0), 0);
    const valorEstoqueVenda = bolsas.reduce((acc, b) => acc + (b.quantidade * Number(b.preco_venda)), 0);
    const totalModelosCadastrados = bolsas.length;

    // Produtos com estoque crítico (abaixo ou igual à quantidade mínima)
    const estoqueCritico = bolsas
      .filter(b => (b.quantidade || 0) <= (b.quantidade_minima || 2))
      .sort((a, b) => (a.quantidade || 0) - (b.quantidade || 0));
    const totalEstoqueCriticoCount = estoqueCritico.length;
    const estoqueCriticoLimitado = estoqueCritico.slice(0, 10);

    // Produtos mais vendidos do período (Top Sellers)
    const topSellersMap = {};
    relatorioVendas.forEach(v => {
      if (v.devolvida) return; // Ignorar vendas devolvidas no ranking de mais vendidos
      
      const bolsaId = v.bolsa_id;
      if (bolsaId) {
        if (!topSellersMap[bolsaId]) {
          const b = bolsas.find(bolsa => bolsa.id === bolsaId);
          topSellersMap[bolsaId] = {
            nome: b ? b.nome : v.bolsas?.nome || "Produto Desconhecido",
            codigo: b ? b.codigo : v.bolsas?.codigo || "—",
            quantidade: 0,
            totalFaturado: 0
          };
        }
        topSellersMap[bolsaId].quantidade += 1;
        topSellersMap[bolsaId].totalFaturado += Number(v.preco_vendido) || 0;
      }
    });
    const topSellers = Object.values(topSellersMap)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    const formasPagamentoList = [
      { key: "dinheiro", label: "💵 Dinheiro", value: relatorioStats.dinheiro },
      { key: "debito", label: "💳 Débito", value: relatorioStats.debito },
      { key: "credito", label: "💳 Crédito", value: relatorioStats.credito },
      { key: "pix", label: "📱 Pix", value: relatorioStats.pix },
      { key: "boleto", label: "📄 Boleto", value: relatorioStats.boleto || 0 },
      { key: "credito_parcelado", label: "💳 Crédito Parcelado", value: relatorioStats.credito_parcelado },
      { key: "credito_a_vista", label: "💳 Crédito à Vista", value: relatorioStats.credito_a_vista },
      { key: "voucher", label: "🎟️ Voucher", value: relatorioStats.voucher },
      { key: "pix_online", label: "🌐 Pix Online (Site)", value: relatorioStats.pix_online }
    ].sort((a, b) => b.value - a.value);

    const trocasDetalhadas = relatorioTrocas.map(t => {
      const bDev = bolsas.find(b => b.id === t.bolsa_devolvida_id);
      const bNova = bolsas.find(b => b.id === t.bolsa_nova_id);
      
      const precoNova = bNova 
        ? (bNova.desconto_ativo && bNova.preco_desconto ? Number(bNova.preco_desconto) : Number(bNova.preco_venda))
        : 0;
      
      const diferenca = Number(t.diferenca_valor) || 0;
      const precoDevolvido = precoNova - diferenca;
      
      let formaPagtoDiff = "—";
      if (diferenca > 0) {
        const match = t.motivo?.match(/Diferença paga via:\s*(\w+)/i);
        formaPagtoDiff = match ? match[1].toUpperCase() : "PIX";
      }
      
      const motivoLimpo = t.motivo?.split(". Diferença paga via:")[0] || "—";
      
      return {
        ...t,
        nomeDevolvida: bDev ? bDev.nome : t.devolvida?.nome || "Produto Devolvido",
        codDevolvida: bDev ? bDev.codigo : t.devolvida?.codigo || "—",
        nomeNova: bNova ? bNova.nome : t.nova?.nome || "Produto Novo",
        codNova: bNova ? bNova.codigo : t.nova?.codigo || "—",
        precoDevolvido,
        precoNova,
        formaPagtoDiff,
        motivoLimpo
      };
    });

    const totalDevolvido = trocasDetalhadas.reduce((acc, t) => acc + t.precoDevolvido, 0);
    const totalNovo = trocasDetalhadas.reduce((acc, t) => acc + t.precoNova, 0);
    const saldoTrocasConsolidado = totalNovo - totalDevolvido;

    const totalDescontos = relatorioVendas.filter(v => !v.devolvida).reduce((acc, v) => acc + (Number(v.desconto_valor) || 0), 0);
    const faturamentoBruto = relatorioStats.totalFaturado + totalDescontos;

    const htmlContent = gerarRelatorioHtml({
      nomeArquivo,
      dataHoraGeracao,
      dataInicioFmt,
      dataFimFmt,
      operadorNome,
      operadorCargo,
      faturamentoHoje,
      qtdHoje,
      totalEstoqueItens,
      valorEstoqueVenda,
      totalModelosCadastrados,
      estoqueCriticoLimitado,
      totalEstoqueCriticoCount,
      topSellers,
      formasPagamentoList,
      relatorioStats,
      rankingVendedoresPeriodo,
      totalDevolvido,
      totalNovo,
      saldoTrocasConsolidado,
      totalDescontos,
      faturamentoBruto,
      totalEntradasPeriodo,
      relatorioTrocas
    });

    // Criar ou obter o container para a impressão
    let printContainer = document.getElementById("print-area-container");
    if (!printContainer) {
      printContainer = document.createElement("div");
      printContainer.id = "print-area-container";
      document.body.appendChild(printContainer);
    }
    printContainer.innerHTML = htmlContent;

    // Salvar o título original e definir o novo título para o nome do arquivo PDF sugerido
    const originalTitle = document.title;
    document.title = nomeArquivo;

    // Disparar a impressão nativa
    window.print();

    // Restaurar o título original
    document.title = originalTitle;

    // Remover o container após um delay curto
    setTimeout(() => {
      if (printContainer && printContainer.parentNode) {
        printContainer.parentNode.removeChild(printContainer);
      }
    }, 1000);
  };

  // Add / Edit Bolsa
  const handleSaveBolsa = async (e) => {
    e.preventDefault();
    if (!formBolsa.codigo || !formBolsa.nome || !formBolsa.preco_venda) {
      alert("Preencha todos os campos obrigatórios (Código, Nome, Preço Venda)");
      return;
    }

    try {
      if (editingBolsa) {
        // Update direct details & quantity
        const { error } = await supabase
          .from("bolsas")
          .update({
            codigo: formBolsa.codigo,
            nome: formBolsa.nome,
            marca: formBolsa.marca,
            cor: formBolsa.cor,
            tamanho: formBolsa.tamanho,
            material: formBolsa.material,
            foto_url: formBolsa.foto_url || null,
            preco_custo: formBolsa.preco_custo ? Number(formBolsa.preco_custo) : null,
            preco_venda: Number(formBolsa.preco_venda),
            quantidade: Number(formBolsa.quantidade || 0),
            quantidade_minima: Number(formBolsa.quantidade_minima || 2),
            status: Number(formBolsa.quantidade || 0) === 0 ? "vendida" : "disponivel"
          })
          .eq("id", editingBolsa.id);

        if (error) throw error;
        alert("Produto atualizado com sucesso!");
        setEditingBolsa(null);
      } else {
        // Check if bolsa code already exists
        const { data: existingBolsa } = await supabase
          .from("bolsas")
          .select("*")
          .eq("codigo", formBolsa.codigo)
          .maybeSingle();

        let bolsaId = null;

        if (existingBolsa) {
          // Update quantity and details
          const updatedQty = Number(existingBolsa.quantidade) + Number(formBolsa.quantidade);
          const { data, error } = await supabase
            .from("bolsas")
            .update({
              nome: formBolsa.nome,
              marca: formBolsa.marca || existingBolsa.marca,
              cor: formBolsa.cor || existingBolsa.cor,
              tamanho: formBolsa.tamanho || existingBolsa.tamanho,
              material: formBolsa.material || existingBolsa.material,
              foto_url: formBolsa.foto_url || existingBolsa.foto_url,
              preco_custo: Number(formBolsa.preco_custo) || existingBolsa.preco_custo,
              preco_venda: Number(formBolsa.preco_venda),
              quantidade: updatedQty,
              status: "disponivel"
            })
            .eq("id", existingBolsa.id)
            .select()
            .single();

          if (error) throw error;
          bolsaId = data.id;
        } else {
          // Insert new bolsa
          const { data, error } = await supabase
            .from("bolsas")
            .insert({
              codigo: formBolsa.codigo,
              nome: formBolsa.nome,
              marca: formBolsa.marca,
              cor: formBolsa.cor,
              tamanho: formBolsa.tamanho,
              material: formBolsa.material,
              foto_url: formBolsa.foto_url || null,
              preco_custo: formBolsa.preco_custo ? Number(formBolsa.preco_custo) : null,
              preco_venda: Number(formBolsa.preco_venda),
              quantidade: Number(formBolsa.quantidade || 0),
              quantidade_minima: Number(formBolsa.quantidade_minima || 2),
              status: "disponivel"
            })
            .select()
            .single();

          if (error) throw error;
          bolsaId = data.id;
        }

        // Record entrada details
        const { error: entErr } = await supabase
          .from("entradas")
          .insert({
            bolsa_id: bolsaId,
            quantidade: Number(formBolsa.quantidade),
            preco_custo: formBolsa.preco_custo ? Number(formBolsa.preco_custo) : null,
            funcionario_id: profile.id,
            observacao: "Entrada registrada no app"
          });

        if (entErr) throw entErr;

        alert("Entrada de estoque salva com sucesso!");
      }

      setFormBolsa({
        codigo: "", nome: "", marca: "", cor: "", tamanho: "", 
        material: "", foto_url: "", preco_custo: "", preco_venda: "", 
        preco_desconto: "", desconto_ativo: false, quantidade: 1, quantidade_minima: 2
      });
      loadAllData();
      setActiveTab("estoque");
    } catch (err) {
      alert("Erro ao salvar produto: " + err.message);
    }
  };

  // Add / Edit Cliente
  const handleSaveCliente = async (e) => {
    e.preventDefault();
    if (!formCliente.nome) {
      alert("Nome é obrigatório!");
      return;
    }

    try {
      if (editingCliente) {
        // Update client
        const { error } = await supabase
          .from("clientes")
          .update({
            nome: formCliente.nome,
            telefone: formCliente.telefone || null,
            email: formCliente.email || null,
            cpf: formCliente.cpf || null
          })
          .eq("id", editingCliente.id);

        if (error) throw error;

        alert("Cliente atualizado com sucesso!");
        setEditingCliente(null);
      } else {
        // Insert new client
        const { error } = await supabase
          .from("clientes")
          .insert({
            nome: formCliente.nome,
            telefone: formCliente.telefone || null,
            email: formCliente.email || null,
            cpf: formCliente.cpf || null
          });

        if (error) throw error;

        alert("Cliente cadastrado com sucesso!");
      }

      setFormCliente({ nome: "", telefone: "", email: "", cpf: "" });
      loadAllData();
    } catch (err) {
      alert("Erro ao salvar cliente: " + err.message);
    }
  };

  // Register Venda
  const handleSaveVenda = async (e) => {
    e.preventDefault();
    if (!formVenda.cliente_id) {
      alert("Selecione o cliente destinatário!");
      return;
    }
    if (cart.length === 0) {
      alert("Adicione pelo menos um produto ao carrinho!");
      return;
    }

    try {
      // Double check stock availability for all cart items before proceeding
      for (const item of cart) {
        const bolsa = bolsas.find(b => b.id === item.id);
        if (!bolsa || bolsa.quantidade < item.qty) {
          alert(`Estoque insuficiente para o produto: ${item.nome}! (Estoque disponível: ${bolsa ? bolsa.quantidade : 0})`);
          return;
        }
      }

      // Calculate subtotal of cart
      const subtotal = cart.reduce((acc, item) => {
        const price = item.desconto_ativo && item.preco_desconto ? Number(item.preco_desconto) : Number(item.preco_venda);
        return acc + (price * item.qty);
      }, 0);
      const descManualTotal = Math.min(Number(descontoVenda) || 0, subtotal);

      // 1. Build rows to insert in bulk to "vendas"
      // Since each row in "vendas" represents 1 unit, if an item in the cart has qty = N, we repeat it N times.
      const rowsToInsert = [];
      let descontoDistribuidoAcumulado = 0;

      // Build units list
      const unidadesPlanas = [];
      for (const item of cart) {
        const precoBase = item.desconto_ativo && item.preco_desconto 
          ? Number(item.preco_desconto) 
          : Number(item.preco_venda);
        const descontoPromo = item.desconto_ativo && item.preco_desconto 
          ? (Number(item.preco_venda) - Number(item.preco_desconto)) 
          : 0;

        for (let i = 0; i < item.qty; i++) {
          unidadesPlanas.push({
            item,
            precoBase,
            descontoPromo
          });
        }
      }

      // Distribute manual discount proportionally among units
      const totalUnidades = unidadesPlanas.length;
      unidadesPlanas.forEach((u, index) => {
        let descUnidade = 0;
        if (descManualTotal > 0 && subtotal > 0) {
          if (index === totalUnidades - 1) {
            descUnidade = Number((descManualTotal - descontoDistribuidoAcumulado).toFixed(2));
          } else {
            descUnidade = Number(((u.precoBase / subtotal) * descManualTotal).toFixed(2));
            descontoDistribuidoAcumulado += descUnidade;
          }
        }

        const precoFinalVendido = Number(Math.max(0, u.precoBase - descUnidade).toFixed(2));
        const descontoValorFinal = Number((u.descontoPromo + descUnidade).toFixed(2));

        rowsToInsert.push({
          bolsa_id: u.item.id,
          cliente_id: formVenda.cliente_id,
          funcionario_id: formVenda.funcionario_id || profile.id,
          preco_vendido: precoFinalVendido,
          tinha_desconto: u.item.desconto_ativo,
          desconto_valor: descontoValorFinal,
          observacao: formVenda.observacao 
            ? `${formVenda.observacao}${descManualTotal > 0 && index === 0 ? ` [Desconto manual de R$ ${descManualTotal.toFixed(2)} aplicado]` : ""}`
            : (descManualTotal > 0 && index === 0 ? `[Desconto manual de R$ ${descManualTotal.toFixed(2)} aplicado]` : null),
          forma_pagamento: formVenda.forma_pagamento || "dinheiro"
        });
      });

      // 2. Perform atomic sale transaction via RPC in Supabase
      const { error: sellErr } = await supabase
        .rpc("registrar_venda_transacao", {
          p_cliente_id: formVenda.cliente_id,
          p_funcionario_id: formVenda.funcionario_id || profile.id,
          p_forma_pagamento: formVenda.forma_pagamento || "dinheiro",
          p_observacao: formVenda.observacao || null,
          p_itens: rowsToInsert
        });

      if (sellErr) throw sellErr;

      alert("Venda de múltiplos itens registrada com sucesso!");
      setFormVenda({ bolsa_id: "", cliente_id: "", preco_vendido: "", observacao: "", forma_pagamento: "dinheiro", funcionario_id: "" });
      setCart([]); // Clear the shopping cart
      setDescontoVenda(""); // Reset desconto
      loadAllData();
      setActiveTab("saidas");
    } catch (err) {
      alert("Erro ao registrar venda: " + err.message);
    }
  };

  // Buscar produto devolvido por código de etiqueta
  const handleBuscarCodigoDevolvido = () => {
    if (!codigoDevolvido.trim()) {
      setFeedbackDevolvido({ success: false, message: "Digite um código de produto!" });
      return;
    }

    const cod = codigoDevolvido.trim().toUpperCase();
    const bolsaDev = bolsas.find(b => b.codigo?.toUpperCase() === cod);
    if (!bolsaDev) {
      setFeedbackDevolvido({ success: false, message: `Código "${cod}" não cadastrado no estoque!` });
      setFormTroca(prev => ({ ...prev, venda_id: "", bolsa_devolvida_id: "" }));
      return;
    }

    let vendaCorrespondente = null;
    if (formTroca.cliente_id) {
      vendaCorrespondente = vendas.find(v => v.bolsa_id === bolsaDev.id && v.cliente_id === formTroca.cliente_id);
    }
    
    if (!vendaCorrespondente) {
      vendaCorrespondente = vendas.find(v => v.bolsa_id === bolsaDev.id);
    }

    if (!vendaCorrespondente) {
      setFeedbackDevolvido({ 
        success: false, 
        message: `Produto localizado ("${bolsaDev.nome}"), mas não há vendas dele no histórico!` 
      });
      setFormTroca(prev => ({ ...prev, venda_id: "", bolsa_devolvida_id: "" }));
      return;
    }

    const clienteDestaVenda = clientes.find(c => c.id === vendaCorrespondente.cliente_id);
    const nomeCliente = clienteDestaVenda ? clienteDestaVenda.nome : "Consumidor Geral";

    setFormTroca(prev => ({
      ...prev,
      cliente_id: vendaCorrespondente.cliente_id,
      venda_id: vendaCorrespondente.id,
      bolsa_devolvida_id: bolsaDev.id
    }));

    setFeedbackDevolvido({
      success: true,
      message: `Encontrado: "${bolsaDev.nome}" • Cliente: ${nomeCliente} • Valor pago: R$ ${Number(vendaCorrespondente.preco_vendido).toFixed(2)}`
    });
  };

  // Buscar novo produto por código de etiqueta
  const handleBuscarCodigoNovo = () => {
    if (!codigoNovo.trim()) {
      setFeedbackNovo({ success: false, message: "Digite um código de produto!" });
      return;
    }

    const cod = codigoNovo.trim().toUpperCase();
    const bolsaNova = bolsas.find(b => b.codigo?.toUpperCase() === cod);
    
    if (!bolsaNova) {
      setFeedbackNovo({ success: false, message: `Código "${cod}" não cadastrado no estoque!` });
      setFormTroca(prev => ({ ...prev, bolsa_nova_id: "" }));
      return;
    }

    if (bolsaNova.quantidade <= 0) {
      setFeedbackNovo({ success: false, message: `"${bolsaNova.nome}" está sem estoque disponível!` });
      setFormTroca(prev => ({ ...prev, bolsa_nova_id: "" }));
      return;
    }

    const precoExibido = bolsaNova.desconto_ativo && bolsaNova.preco_desconto 
      ? Number(bolsaNova.preco_desconto) 
      : Number(bolsaNova.preco_venda);

    setFormTroca(prev => ({
      ...prev,
      bolsa_nova_id: bolsaNova.id
    }));

    setFeedbackNovo({
      success: true,
      message: `Selecionado: "${bolsaNova.nome}" • Preço: R$ ${precoExibido.toFixed(2)} (Estoque: ${bolsaNova.quantidade})`
    });
  };

  // Register Troca
  const handleSaveTroca = async (e) => {
    e.preventDefault();
    if (!formTroca.cliente_id || !formTroca.venda_id || !formTroca.bolsa_devolvida_id || !formTroca.bolsa_nova_id) {
      alert("Preencha todos os campos da troca!");
      return;
    }

    try {
      const devolvida = bolsas.find(b => b.id === formTroca.bolsa_devolvida_id);
      const nova = bolsas.find(b => b.id === formTroca.bolsa_nova_id);

      if (!devolvida || !nova) {
        alert("Produto devolvido ou novo não encontrado!");
        return;
      }

      if (nova.quantidade <= 0) {
        alert("Produto novo escolhido está sem estoque!");
        return;
      }

      // Calculate difference in value using the original price paid
      const vendaOrig = vendas.find(v => v.id === formTroca.venda_id);
      const precoPagoOriginal = vendaOrig ? Number(vendaOrig.preco_vendido) : 0;
      const precoBaseNova = Number(nova.preco_venda);
      const descontoNova = Number(formTroca.desconto_novo) || 0;
      const precoNovaCobrado = precoBaseNova - descontoNova;
      const diferenca = precoNovaCobrado - precoPagoOriginal;

      // 1. Perform atomic exchange transaction via RPC in Supabase
      const { error: exchangeErr } = await supabase
        .rpc("registrar_troca_transacao", {
          p_cliente_id: formTroca.cliente_id,
          p_bolsa_devolvida_id: devolvida.id,
          p_bolsa_nova_id: nova.id,
          p_funcionario_id: profile.id,
          p_motivo: diferenca > 0 
            ? `${formTroca.motivo || "Troca de produto"}. Diferença paga via: ${formTroca.forma_pagamento?.toUpperCase() || "PIX"}`
            : formTroca.motivo,
          p_diferenca_valor: diferenca,
          p_forma_pagamento: formTroca.forma_pagamento || "pix",
          p_venda_orig_id: formTroca.venda_id || null,
          p_preco_venda_novo: precoNovaCobrado,
          p_desconto_novo: descontoNova,
          p_tinha_desconto_novo: descontoNova > 0
        });

      if (exchangeErr) throw exchangeErr;

      if (diferenca > 0) {
        alert(`Troca concluída! Diferença a pagar: R$ ${diferenca.toFixed(2)} via ${formTroca.forma_pagamento?.toUpperCase() || "PIX"}`);
      } else if (diferenca < 0) {
        alert(`Troca concluída! O cliente ficou com um crédito de: R$ ${Math.abs(diferenca).toFixed(2)} na loja.`);
      } else {
        alert(`Troca concluída! Sem diferença de valor.`);
      }

      setFormTroca({ cliente_id: "", venda_id: "", bolsa_devolvida_id: "", bolsa_nova_id: "", motivo: "", forma_pagamento: "pix", desconto_novo: 0 });
      setCodigoDevolvido("");
      setCodigoNovo("");
      setFeedbackDevolvido(null);
      setFeedbackNovo(null);
      loadAllData();
      setActiveTab("troca");
    } catch (err) {
      alert("Erro ao registrar troca: " + err.message);
    }
  };

  // Rastrear troca de produto devolvido
  const handleRastrearTroca = (bolsaId, clienteId) => {
    const trocaCorrespondente = trocas.find(
      t => t.bolsa_devolvida_id === bolsaId && t.cliente_id === clienteId
    );

    if (trocaCorrespondente) {
      setActiveTab("troca");
      setHighlightedExchangeId(trocaCorrespondente.id);

      // Aguarda renderização da aba e realiza o scroll suave
      setTimeout(() => {
        const element = document.getElementById(`troca-row-${trocaCorrespondente.id}`) ||
                        document.getElementById(`troca-card-${trocaCorrespondente.id}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 200);

      // Limpa o destaque após 3 segundos
      setTimeout(() => {
        setHighlightedExchangeId(null);
      }, 3000);
    } else {
      alert("Aviso: Registro detalhado desta troca não foi localizado no histórico.");
    }
  };

  // Manage discounts toggling (Admin only)
  const handleToggleDesconto = async (bolsaId, isActive, precoDesc) => {
    try {
      const { error } = await supabase
        .from("bolsas")
        .update({
          desconto_ativo: isActive,
          preco_desconto: precoDesc ? Number(precoDesc) : null
        })
        .eq("id", bolsaId);

      if (error) throw error;
      loadAllData();
    } catch (err) {
      alert("Erro ao atualizar desconto: " + err.message);
    }
  };

  // Manage employees toggling (Admin only)
  const handleToggleFuncionarioStatus = async (funcionarioId, isAtivo) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ativo: isAtivo })
        .eq("id", funcionarioId);

      if (error) throw error;
      loadAllData();
      alert("Status do funcionário atualizado!");
    } catch (err) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  // Promotional discount input helper
  const handlePromoChange = (bolsaId, val) => {
    setBolsas(prev => prev.map(b => b.id === bolsaId ? { ...b, tempPromo: val } : b));
  };

  // Filtering Bolsas for stock page
  const filteredBolsas = useMemo(() => {
    return bolsas.filter(b => {
      const matchesSearch = b.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            b.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (b.marca && b.marca.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesMarca = filterMarca ? b.marca === filterMarca : true;
      const matchesCor = filterCor ? b.cor === filterCor : true;
      
      let matchesStatus = true;
      if (filterStatus === "disponivel") matchesStatus = b.quantidade > 0;
      else if (filterStatus === "esgotado") matchesStatus = b.quantidade <= 0;
      else if (filterStatus === "baixo_estoque") matchesStatus = b.quantidade <= Math.max(Number(b.quantidade_minima || 0), 2);
      
      let matchesDesconto = true;
      if (filterDesconto === "ativo") matchesDesconto = b.desconto_ativo;
      else if (filterDesconto === "inativo") matchesDesconto = !b.desconto_ativo;

      return matchesSearch && matchesMarca && matchesCor && matchesStatus && matchesDesconto;
    });
  }, [bolsas, searchQuery, filterMarca, filterCor, filterStatus, filterDesconto]);

  // Unique list values for filtering
  const marcasList = useMemo(() => [...new Set(bolsas.map(b => b.marca).filter(Boolean))], [bolsas]);
  const coresList = useMemo(() => [...new Set(bolsas.map(b => b.cor).filter(Boolean))], [bolsas]);

  // Dashboard Vendas Filtradas (must be declared before dashboardStats)
  const dashboardVendasFiltradas = useMemo(() => {
    if (!dashboardDataInicio || !dashboardDataFim) return vendas;
    return vendas.filter(v => {
      const dataVStr = getLocalDateStr(v.created_at);
      return dataVStr >= dashboardDataInicio && dataVStr <= dashboardDataFim;
    });
  }, [vendas, dashboardDataInicio, dashboardDataFim]);

  // Dashboard Trocas Filtradas (must be declared before dashboardStats)
  const dashboardTrocasFiltradas = useMemo(() => {
    if (!dashboardDataInicio || !dashboardDataFim) return trocas;
    return trocas.filter(t => {
      const dataTStr = getLocalDateStr(t.created_at || t.data);
      return dataTStr >= dashboardDataInicio && dataTStr <= dashboardDataFim;
    });
  }, [trocas, dashboardDataInicio, dashboardDataFim]);

  // Financial Dashboard calculation
  const dashboardStats = useMemo(() => {
    const totalDisponiveis = bolsas.reduce((acc, b) => acc + (b.quantidade > 0 ? b.quantidade : 0), 0);
    const valorTotalEstoque = bolsas.reduce((acc, b) => acc + (b.quantidade * Number(b.preco_venda)), 0);
    const totalDescontos = bolsas.filter(b => b.desconto_ativo).length;
    
    // Filtrando vendas por período e vendedor
    let vendasFiltro = dashboardVendasFiltradas;
    if (dashboardVendedorFilter && dashboardVendedorFilter !== "all") {
      vendasFiltro = vendasFiltro.filter(v => v.funcionario_id === dashboardVendedorFilter);
    }

    // Filtrando trocas por período e vendedor
    let trocasFiltro = dashboardTrocasFiltradas;
    if (dashboardVendedorFilter && dashboardVendedorFilter !== "all") {
      trocasFiltro = trocasFiltro.filter(t => t.funcionario_id === dashboardVendedorFilter);
    }

    const faturamentoVendasMes = vendasFiltro.filter(v => !v.devolvida).reduce((acc, v) => acc + Number(v.preco_vendido), 0);
    const totalFaturadoMes = faturamentoVendasMes;
    const qtdVendasMes = vendasFiltro.filter(v => !v.devolvida).length;

    // Alertas de estoque baixo
    const alertasEstoque = bolsas.filter(b => b.quantidade <= Math.max(Number(b.quantidade_minima || 0), 2));

    // Faturamento Diário (Faturamento de Hoje) usando string YYYY-MM-DD local
    let vendasHoje = vendas.filter(v => {
      return getLocalDateStr(v.created_at) === hojeStr;
    });
    if (dashboardVendedorFilter && dashboardVendedorFilter !== "all") {
      vendasHoje = vendasHoje.filter(v => v.funcionario_id === dashboardVendedorFilter);
    }

    let trocasHoje = trocas.filter(t => {
      return getLocalDateStr(t.created_at || t.data) === hojeStr;
    });
    if (dashboardVendedorFilter && dashboardVendedorFilter !== "all") {
      trocasHoje = trocasHoje.filter(t => t.funcionario_id === dashboardVendedorFilter);
    }

    const faturamentoVendasHoje = vendasHoje.filter(v => !v.devolvida).reduce((acc, v) => acc + Number(v.preco_vendido), 0);
    const faturamentoHoje = faturamentoVendasHoje;
    const qtdVendasHoje = vendasHoje.filter(v => !v.devolvida).length;

    return {
      totalDisponiveis,
      valorTotalEstoque,
      totalDescontos,
      totalFaturadoMes,
      qtdVendasMes,
      alertasEstoque,
      faturamentoHoje,
      qtdVendasHoje
    };
  }, [bolsas, vendas, trocas, dashboardVendasFiltradas, dashboardTrocasFiltradas, dashboardVendedorFilter]);

  // Handle keyboard shortcuts (Alt + P, Alt + C, Alt + F, Alt + D, Alt + S) and Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in inputs or textareas
      if (
        e.target.tagName === "INPUT" || 
        e.target.tagName === "TEXTAREA" || 
        e.target.isContentEditable
      ) {
        return;
      }

      // ESC key to close popovers
      if (e.key === "Escape") {
        setShowMonthSelector(false);
        setShowFilterDropdown(false);
      }

      // Physical shortcuts using Alt key
      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "p") {
          e.preventDefault();
          setDashboardDateFilter(new Date());
          setDashboardVendedorFilter("all");
          triggerToast("Filtros de faturamento limpos!");
        } else if (key === "c") {
          e.preventDefault();
          setShowMonthSelector(prev => !prev);
          setShowFilterDropdown(false);
        } else if (key === "f") {
          e.preventDefault();
          setShowFilterDropdown(prev => !prev);
          setShowMonthSelector(false);
        } else if (key === "d") {
          e.preventDefault();
          handleExportDashboard();
        } else if (key === "s") {
          e.preventDefault();
          handleShareDashboard();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    funcionarios, 
    vendas, 
    dashboardDateFilter, 
    dashboardVendedorFilter, 
    showMonthSelector, 
    showFilterDropdown,
    dashboardStats
  ]);



  // Informações de texto dinâmicas do período ativo do Dashboard
  const dashboardPeriodoInfo = useMemo(() => {
    if (!dashboardDataInicio || !dashboardDataFim) {
      return { label: "Faturamento Total", desc: "Todo o período acumulado" };
    }
    
    if (dashboardDataInicio === dashboardDataFim) {
      if (dashboardDataInicio === hojeStr) {
        return { label: "Faturamento de Hoje", desc: "Acumulado bruto do dia de hoje" };
      }
      if (dashboardDataInicio === ontemStr) {
        return { label: "Faturamento de Ontem", desc: "Acumulado bruto do dia de ontem" };
      }
      
      const d = new Date(dashboardDataInicio + "T12:00:00");
      const dateFormatted = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      return { label: `Faturamento em ${dateFormatted}`, desc: `Acumulado bruto do dia ${dateFormatted}` };
    }
    
    if (dashboardDataInicio === inicioMesStr && dashboardDataFim === hojeStr) {
      return { label: "Faturamento deste Mês", desc: "Acumulado bruto desde o dia 1º deste mês" };
    }
    
    if (dashboardDataInicio === seteDiasStr && dashboardDataFim === hojeStr) {
      return { label: "Faturamento dos Últimos 7 Dias", desc: "Acumulado bruto dos últimos 7 dias" };
    }
    
    // Se for um mês fechado
    const dIni = new Date(dashboardDataInicio + "T12:00:00");
    const dFim = new Date(dashboardDataFim + "T12:00:00");
    if (dIni.getDate() === 1 && new Date(dIni.getFullYear(), dIni.getMonth() + 1, 0).getDate() === dFim.getDate() && dIni.getMonth() === dFim.getMonth() && dIni.getFullYear() === dFim.getFullYear()) {
      const mesNome = dIni.toLocaleString("pt-BR", { month: "long", year: "numeric" });
      return { label: `Faturamento de ${mesNome.toUpperCase()}`, desc: `Acumulado fechado do mês de ${mesNome}` };
    }
    
    const startFmt = dIni.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const endFmt = dFim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return { label: `Faturamento no Período`, desc: `Acumulado de ${startFmt} a ${endFmt}` };
  }, [dashboardDataInicio, dashboardDataFim, hojeStr, ontemStr, seteDiasStr, inicioMesStr]);

  // Ranking de Vendas por Vendedor
  const rankingVendedores = useMemo(() => {
    const mapa = {};
    // Inicializar com todos os funcionários ativos/inativos cadastrados
    funcionarios.forEach(f => {
      mapa[f.id] = { id: f.id, nome: f.nome, role: f.role, total: 0, quantidade: 0 };
    });

    dashboardVendasFiltradas.forEach(v => {
      if (v.devolvida) return; // Ignorar vendas devolvidas no faturamento do vendedor
      
      const fid = v.funcionario_id;
      if (fid) {
        if (!mapa[fid]) {
          mapa[fid] = { id: fid, nome: v.profiles?.nome || "Ex-colaborador", role: "funcionario", total: 0, quantidade: 0 };
        }
        mapa[fid].total += Number(v.preco_vendido) || 0;
        mapa[fid].quantidade += 1;
      }
    });

    // Trocas não entram no faturamento do vendedor para evitar dupla dedução/ajustes negativos de caixa
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [dashboardVendasFiltradas, dashboardTrocasFiltradas, funcionarios]);

  // Relatorios Vendas Filtradas
  const relatorioVendas = useMemo(() => {
    if (!relatorioDataInicio || !relatorioDataFim) return vendas;
    
    return vendas.filter(v => {
      const dataVStr = getLocalDateStr(v.created_at);
      return dataVStr >= relatorioDataInicio && dataVStr <= relatorioDataFim;
    });
  }, [vendas, relatorioDataInicio, relatorioDataFim]);

  // Trocas filtradas pelo período do relatório
  const relatorioTrocas = useMemo(() => {
    if (!relatorioDataInicio || !relatorioDataFim) return trocas;
    return trocas.filter(t => {
      const dataStr = getLocalDateStr(t.created_at || t.data);
      return dataStr >= relatorioDataInicio && dataStr <= relatorioDataFim;
    });
  }, [trocas, relatorioDataInicio, relatorioDataFim]);

  const relatorioStats = useMemo(() => {
    let dinheiro = 0;
    let debito = 0;
    let credito = 0;
    let pix = 0;
    let boleto = 0;
    let credito_parcelado = 0;
    let credito_a_vista = 0;
    let voucher = 0;
    let pix_online = 0;
    let totalFaturado = 0;
    
    relatorioVendas.forEach(v => {
      if (v.devolvida) return; // Ignorar vendas devolvidas no faturamento do caixa
      
      const valor = Number(v.preco_vendido) || 0;
      totalFaturado += valor;
      
      const forma = v.forma_pagamento;
      if (forma === "dinheiro") dinheiro += valor;
      else if (forma === "debito") debito += valor;
      else if (forma === "credito") credito += valor;
      else if (forma === "pix") pix += valor;
      else if (forma === "boleto") boleto += valor;
      else if (forma === "credito_parcelado") credito_parcelado += valor;
      else if (forma === "credito_a_vista") credito_a_vista += valor;
      else if (forma === "voucher") voucher += valor;
      else if (forma === "pix_online") pix_online += valor;
      else {
        dinheiro += valor;
      }
    });

    return {
      dinheiro,
      debito,
      credito,
      pix,
      boleto,
      credito_parcelado,
      credito_a_vista,
      voucher,
      pix_online,
      totalFaturado,
      totalSair: relatorioVendas.filter(v => !v.devolvida).length
    };
  }, [relatorioVendas, relatorioTrocas]);

  // Ranking de Vendas por Vendedor do Período de Relatórios
  const rankingVendedoresPeriodo = useMemo(() => {
    const mapa = {};
    // Inicializar com todos os funcionários cadastrados
    funcionarios.forEach(f => {
      mapa[f.id] = { id: f.id, nome: f.nome, role: f.role, total: 0, quantidade: 0 };
    });

    relatorioVendas.forEach(v => {
      if (v.devolvida) return; // Ignorar vendas devolvidas no faturamento do vendedor
      
      const fid = v.funcionario_id;
      if (fid) {
        if (!mapa[fid]) {
          mapa[fid] = { id: fid, nome: v.profiles?.nome || "Ex-colaborador", role: "funcionario", total: 0, quantidade: 0 };
        }
        mapa[fid].total += Number(v.preco_vendido) || 0;
        mapa[fid].quantidade += 1;
      }
    });

    // Trocas não entram no faturamento do vendedor para evitar dupla dedução/ajustes negativos de caixa
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [relatorioVendas, relatorioTrocas, funcionarios]);

  // Faturamento Mensal Acumulado - Mês Corrente (Seção 9 do Relatório)
  const dadosMensais = useMemo(() => {
    const dataReferencia = relatorioDataFim ? new Date(relatorioDataFim + "T12:00:00") : new Date();
    const anoAtual = dataReferencia.getFullYear();
    const mesAtual = dataReferencia.getMonth(); // 0-11
    
    // Filtrar todas as vendas do mês (apenas as ativas, não devolvidas)
    const vendasMesAtual = vendas.filter(v => {
      const d = new Date(v.created_at);
      return d.getFullYear() === anoAtual && d.getMonth() === mesAtual && !v.devolvida;
    });

    const totalDiasMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const faturamentoDia = Array(totalDiasMes + 1).fill(0);
    const quantidadeDia = Array(totalDiasMes + 1).fill(0);

    vendasMesAtual.forEach(v => {
      const d = new Date(v.created_at);
      const dia = d.getDate();
      if (dia >= 1 && dia <= totalDiasMes) {
        const valor = Number(v.preco_vendido) || 0;
        faturamentoDia[dia] += valor;
        quantidadeDia[dia] += 1;
      }
    });

    // Acumulado dia a dia
    const tabelaDiaADia = [];
    let somaAcumulada = 0;
    
    // O dia limite do relatório é o dia da data de referência (se for o mês atual, limitamos até hoje)
    const hoje = new Date();
    const eMesAtual = hoje.getFullYear() === anoAtual && hoje.getMonth() === mesAtual;
    const diaLimite = eMesAtual ? hoje.getDate() : totalDiasMes;

    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const faturamento = faturamentoDia[dia];
      const dataStr = `${String(dia).padStart(2, '0')}/${String(mesAtual + 1).padStart(2, '0')}/${anoAtual}`;
      
      if (dia <= diaLimite) {
        somaAcumulada += faturamento;
        tabelaDiaADia.push({
          dia: String(dia).padStart(2, '0'),
          dataStr,
          faturamento: faturamento,
          acumulado: somaAcumulada,
          quantidade: quantidadeDia[dia],
          ocorreu: true
        });
      } else {
        tabelaDiaADia.push({
          dia: String(dia).padStart(2, '0'),
          dataStr,
          faturamento: null,
          acumulado: null,
          quantidade: null,
          ocorreu: false
        });
      }
    }

    const totalMes = somaAcumulada;
    const diasComVenda = tabelaDiaADia.filter(d => d.ocorreu && d.faturamento > 0).length;
    const mediaDiaria = diasComVenda > 0 ? totalMes / diasComVenda : 0;
    const itensVendidosMes = vendasMesAtual.length;

    // Comparativo com mês anterior se disponível
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;
    const vendasMesAnterior = vendas.filter(v => {
      const d = new Date(v.created_at);
      return d.getFullYear() === anoAnterior && d.getMonth() === mesAnterior;
    });

    const trocasMesAnterior = trocas.filter(t => {
      const d = new Date(t.created_at || t.data);
      return d.getFullYear() === anoAnterior && d.getMonth() === mesAnterior;
    });

    const totalVendasMesAnterior = vendasMesAnterior.reduce((acc, v) => acc + (Number(v.preco_vendido) || 0), 0);
    const totalTrocasMesAnterior = trocasMesAnterior.reduce((acc, t) => acc + (Number(t.diferenca_valor) || 0), 0);
    const totalMesAnterior = totalVendasMesAnterior + totalTrocasMesAnterior;

    let variacaoPct = null;
    if (totalMesAnterior > 0) {
      variacaoPct = ((totalMes - totalMesAnterior) / totalMesAnterior) * 100;
    }

    return {
      tabelaDiaADia,
      totalMes,
      diasComVenda,
      mediaDiaria,
      itensVendidosMes,
      totalMesAnterior,
      variacaoPct,
      nomeMesAtual: dataReferencia.toLocaleString("pt-BR", { month: "long" }),
      nomeMesAnterior: new Date(anoAnterior, mesAnterior, 1).toLocaleString("pt-BR", { month: "long" }),
      anoAtual,
      diaLimite
    };
  }, [vendas, trocas, relatorioDataFim]);

  // Entradas de estoque filtradas pelo período do relatório
  const relatorioEntradas = useMemo(() => {
    if (!relatorioDataInicio || !relatorioDataFim) return entradas;
    return entradas.filter(e => {
      const dataStr = getLocalDateStr(e.created_at);
      return dataStr >= relatorioDataInicio && dataStr <= relatorioDataFim;
    });
  }, [entradas, relatorioDataInicio, relatorioDataFim]);

  // Total de unidades que entraram no estoque no período
  const totalEntradasPeriodo = useMemo(() => {
    return relatorioEntradas.reduce((acc, e) => acc + (Number(e.quantidade) || 0), 0);
  }, [relatorioEntradas]);

  // Agrupar faturamento e quantidade de vendas por data YYYY-MM-DD (filtrado por vendedor)
  const faturamentoPorDia = useMemo(() => {
    const mapa = {};
    let vendasFiltro = vendas;
    if (dashboardVendedorFilter && dashboardVendedorFilter !== "all") {
      vendasFiltro = vendas.filter(v => v.funcionario_id === dashboardVendedorFilter);
    }

    let trocasFiltro = trocas;
    if (dashboardVendedorFilter && dashboardVendedorFilter !== "all") {
      trocasFiltro = trocas.filter(t => t.funcionario_id === dashboardVendedorFilter);
    }

    vendasFiltro.forEach(v => {
      const chave = getLocalDateStr(v.created_at);
      if (!chave) return;
      
      if (!mapa[chave]) {
        mapa[chave] = { total: 0, quantidade: 0 };
      }
      mapa[chave].total += Number(v.preco_vendido) || 0;
      mapa[chave].quantidade += 1;
    });

    trocasFiltro.forEach(t => {
      const chave = getLocalDateStr(t.created_at || t.data);
      if (!chave) return;
      
      if (!mapa[chave]) {
        mapa[chave] = { total: 0, quantidade: 0 };
      }
      mapa[chave].total += Number(t.diferenca_valor || 0);
    });

    return mapa;
  }, [vendas, trocas, dashboardVendedorFilter]);

  // Gráfico de faturamento dos últimos 7 dias (baseado na data selecionada no dashboard)
  const dadosGrafico7Dias = useMemo(() => {
    const resultado = [];
    const now = new Date();
    
    // Se o mês selecionado for o atual, baseamos no dia de hoje.
    // Se for um mês passado, baseamos no último dia daquele mês.
    const targetYear = dashboardDateFilter.getFullYear();
    const targetMonth = dashboardDateFilter.getMonth();
    const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === now.getMonth();
    
    const dataBase = isCurrentMonth ? now : new Date(targetYear, targetMonth + 1, 0);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(dataBase.getTime());
      d.setDate(dataBase.getDate() - i);
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      const chave = `${ano}-${mes}-${dia}`;
      const dados = faturamentoPorDia[chave] || { total: 0, quantidade: 0 };
      resultado.push({
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""),
        total: dados.total,
        quantidade: dados.quantidade,
        chave,
        diaAbrev: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
      });
    }
    return resultado;
  }, [faturamentoPorDia, dashboardDateFilter]);

  // Lista de dias a serem renderizados no calendário do mês em exibição
  const diasDoCalendario = useMemo(() => {
    const ano = mesAnoExibido.getFullYear();
    const mes = mesAnoExibido.getMonth();
    
    const primeiroDia = new Date(ano, mes, 1);
    const diaSemanaInicial = primeiroDia.getDay(); // 0 = Domingo, 1 = Segunda...
    
    const ultimoDia = new Date(ano, mes + 1, 0);
    const totalDias = ultimoDia.getDate();
    
    const resultado = [];
    
    // Dias em branco (mês anterior)
    for (let i = 0; i < diaSemanaInicial; i++) {
      resultado.push({ dia: null, dataStr: null, faturamento: 0, quantidade: 0 });
    }
    
    // Dias do mês atual
    for (let d = 1; d <= totalDias; d++) {
      const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dados = faturamentoPorDia[dataStr] || { total: 0, quantidade: 0 };
      resultado.push({
        dia: d,
        dataStr,
        dateObj: new Date(ano, mes, d),
        faturamento: dados.total,
        quantidade: dados.quantidade
      });
    }
    
    return resultado;
  }, [mesAnoExibido, faturamentoPorDia]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-[#f8f9ff]">
        <div className="w-12 h-12 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin" />
        <h2 className="text-xl font-bold text-on-background tracking-widest font-headline-md">Zero Um</h2>
        <p className="text-sm text-on-tertiary-container font-body-sm">Carregando sistema...</p>
      </div>
    );
  }

  // LOGIN / SIGN UP PAGE WITH PREMIUM TASTE & STYLE
  if (!session) {
    if (isSignUp && !hasNoUsers) {
      setIsSignUp(false);
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#FCFAF9] via-[#FFF2F6] to-[#F3E8EC] relative overflow-hidden">
        {/* Elementos Decorativos Premium de Luz Difusa */}
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#FFEBF2]/50 blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#EACAD6]/30 blur-[100px] pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md bg-white border border-[#EACAD6]/20 rounded-3xl p-10 shadow-[0_20px_60px_rgba(41,20,27,0.06)] flex flex-col gap-8 relative overflow-hidden"
        >
          {/* Luz difusa interna do card */}
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-[#FFEBF2]/40 blur-3xl pointer-events-none"></div>

          <div className="text-center flex flex-col items-center select-none">
            <img 
              src="/logo.jpg" 
              alt="Logo Zero 1 Bags" 
              className="w-48 h-20 object-contain mb-3"
            />
            {/* Nome duplicado removido para evitar repetição */}
            <p className="text-xs uppercase font-extrabold tracking-widest text-[#29141B]/60">Estoque Inteligente de Produtos</p>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="flex flex-col gap-5">
            {isSignUp && (
              <>
                {hasNoUsers && (
                  <div className="rounded-2xl p-4 text-xs bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] flex gap-2.5 items-start">
                    <span className="material-symbols-outlined shrink-0 text-lg mt-0.5">warning</span>
                    <p className="leading-relaxed">Nenhum administrador detectado no sistema. A primeira conta criada será o <strong>Administrador Geral</strong>.</p>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#29141B] font-extrabold text-[11px] uppercase tracking-wider">Nome Completo</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[#29141B]/40">person</span>
                    <input 
                      type="text" 
                      required 
                      value={nome} 
                      onChange={e => setNome(e.target.value)} 
                      placeholder="Digite seu nome" 
                      className="h-12 w-full rounded-xl border border-[#EACAD6]/80 bg-[#FCFAF9] pl-11 pr-4 text-[#29141B] placeholder-[#29141B]/40 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all duration-200 text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#29141B] font-extrabold text-[11px] uppercase tracking-wider">Telefone</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[#29141B]/40">call</span>
                    <input 
                      type="text" 
                      value={telefone} 
                      onChange={e => setTelefone(e.target.value)} 
                      placeholder="(XX) 99999-9999" 
                      className="h-12 w-full rounded-xl border border-[#EACAD6]/80 bg-[#FCFAF9] pl-11 pr-4 text-[#29141B] placeholder-[#29141B]/40 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all duration-200 text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[#29141B] font-extrabold text-[11px] uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[#29141B]/40">mail</span>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="seu@email.com" 
                  className="h-12 w-full rounded-xl border border-[#EACAD6]/80 bg-[#FCFAF9] pl-11 pr-4 text-[#29141B] placeholder-[#29141B]/40 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all duration-200 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#29141B] font-extrabold text-[11px] uppercase tracking-wider">Senha</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[#29141B]/40">lock</span>
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="h-12 w-full rounded-xl border border-[#EACAD6]/80 bg-[#FCFAF9] pl-11 pr-4 text-[#29141B] placeholder-[#29141B]/40 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all duration-200 text-sm"
                />
              </div>
            </div>

            {authError && (
              <p className="text-xs bg-red-50 text-red-600 border border-red-100 rounded-xl p-3.5 leading-relaxed font-medium">
                {authError}
              </p>
            )}

            <button 
              type="submit" 
              className="mt-3 w-full bg-gradient-to-r from-[#D12D6C] via-[#E23B7C] to-[#F44B8C] text-white h-12 rounded-xl font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(209,45,108,0.22)] hover:shadow-[0_6px_20px_rgba(209,45,108,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200"
            >
              {isSignUp ? "Criar Conta Principal" : "Acessar Sistema"}
              <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
            </button>
          </form>

          {hasNoUsers && (
            <div className="text-center mt-1">
              <button 
                onClick={() => setIsSignUp(!isSignUp)} 
                className="text-xs font-bold text-[#D12D6C] hover:text-[#29141B] transition-colors bg-transparent border-none cursor-pointer"
              >
                {isSignUp ? "Já tem uma conta? Faça login" : "Criar Administrador Principal"}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // NAV BAR BUTTON HELPER FOR SIDEBAR (DESKTOP)
  const renderSidebarItem = (tabKey, label, iconName) => {
    const isAct = activeTab === tabKey;
    return (
      <button 
        key={tabKey}
        onClick={() => setActiveTab(tabKey)} 
        className={`w-full flex items-center gap-4 rounded-2xl px-5 py-3.5 text-left transition-all duration-300 transform antialiased group cursor-pointer ${
          isAct 
            ? 'bg-gradient-to-r from-[#D12D6C] via-[#E23B7C] to-[#F44B8C] text-white font-bold shadow-[0_4px_14px_rgba(209,45,108,0.25)] scale-[1.015] -translate-y-0.5' 
            : 'text-[#29141B]/70 hover:bg-[#FFEBF2]/40 hover:text-[#D12D6C] active:scale-[0.985] active:translate-y-0'
        }`}
      >
        <span 
          className="material-symbols-outlined transition-transform duration-300 group-hover:scale-110" 
          style={{ fontVariationSettings: isAct ? "'FILL' 1" : "'FILL' 0" }}
        >
          {iconName}
        </span>
        <span className="font-label-bold text-sm tracking-wide leading-none">{label}</span>
      </button>
    );
  };

  // NAV BAR BUTTON HELPER FOR BOTTOM NAV (MOBILE)
  const renderBottomNavItem = (tabKey, label, iconName) => {
    const isAct = activeTab === tabKey;
    return (
      <button 
        key={tabKey}
        onClick={() => setActiveTab(tabKey)} 
        className={`flex flex-col items-center justify-center rounded-2xl px-3 py-2 transition-all duration-300 transform active:scale-95 antialiased group ${
          isAct 
            ? 'bg-gradient-to-r from-[#D12D6C] to-[#E23B7C] text-white font-bold shadow-[0_2px_8px_rgba(209,45,108,0.2)] scale-[1.02]' 
            : 'text-[#29141B]/70 hover:text-[#D12D6C]'
        }`}
      >
        <span 
          className="material-symbols-outlined transition-transform group-hover:scale-110 text-[20px]"
          style={{ fontVariationSettings: isAct ? "'FILL' 1" : "'FILL' 0" }}
        >
          {iconName}
        </span>
        <span className="font-label-bold text-[9px] mt-0.5 tracking-wide leading-none">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen text-on-background bg-background flex flex-col md:flex-row antialiased">
      {/* Estilos Globais de Impressão (Ajustes de PDF e layout limpo) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Esconder elementos de interface de forma garantida */
          aside, nav, header, button, .print\\:hidden, [aria-label=\"Add Product\"], .material-symbols-outlined {
            display: none !important;
          }
          
          /* Garantir que o container principal ocupe toda a largura */
          main {
            margin-left: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0b1c30 !important;
          }
          
          /* Ajustar fundo e cores para melhor legibilidade na impressora */
          body {
            background-color: #ffffff !important;
            color: #0b1c30 !important;
            font-size: 12px !important;
          }

          /* Evitar cortes feios de cards e tabelas no meio das páginas */
          section, .grid > div, table, tr, tbody {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Remover sombras no print e simplificar bordas */
          .shadow-sm, .shadow-md, .shadow-xl {
            box-shadow: none !important;
          }
          
          .border, .border-outline-variant {
            border-color: #cbd5e1 !important;
          }

          /* Configurações da página no navegador */
          @page {
            size: A4 portrait;
            margin: 1.2cm 1.5cm;
          }

          /* Garantir que textos e valores em dourado apareçam bem e não fiquem apagados */
          .text-\\[\\#C9A84C\\] {
            color: #b3913b !important;
          }
          
          .bg-\\[\\#1A1A2E\\] {
            background-color: #1a1a2e !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
      
      {/* ── NavigationDrawer (Desktop Side Nav) ── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-50 h-full w-80 rounded-r-xl bg-surface-container-lowest shadow-xl border-r border-outline-variant py-6 print:hidden">
        <div className="px-6 mb-6 flex flex-col items-center border-b border-outline-variant pb-5 select-none">
          <img 
            src="/logo.jpg" 
            alt="Logo Zero 1 Bags" 
            className="w-40 h-16 object-contain mb-2"
          />
          <span className="font-extrabold text-[10px] text-[#29141B]/55 tracking-widest uppercase">
            Sistema {profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}
          </span>
        </div>

        {/* Nav list */}
        <nav className="flex-1 px-4 flex flex-col gap-2 overflow-y-auto">
          {renderSidebarItem("dashboard", "Painel", "dashboard")}
          {renderSidebarItem("estoque", "Estoque", "inventory_2")}
          {renderSidebarItem("clientes", "Clientes", "group")}
          {renderSidebarItem("saidas", "Vendas", "receipt_long")}
          {profile?.role === "admin" && renderSidebarItem("relatorios", "Relatórios", "bar_chart")}
          {renderSidebarItem("funcionarios", "Colaboradores", "badge")}
          {renderSidebarItem("troca", "Trocas", "assignment_return")}
        </nav>
      </aside>

      {/* ── Main content area with topbar and pages ── */}
      <main className="flex-1 flex flex-col min-h-screen md:ml-80 pb-24 md:pb-8 print:ml-0 print:pb-0 print:p-0">
        
        <header className="flex justify-between items-center px-container-padding h-14 w-full z-40 bg-surface top-0 sticky shadow-sm md:shadow-none md:border-b md:border-outline-variant md:hidden print:hidden relative">
          {/* Espaçador invisível para balancear o botão de logout e centralizar o logo no meio */}
          <div className="w-10 h-10" />
          
          <div className="flex-1 flex justify-center">
            <img 
              src="/logo.jpg" 
              alt="Logo Zero 1 Bags" 
              className="w-32 h-10 object-contain select-none"
            />
          </div>
          
          <button 
            onClick={handleLogout} 
            className="text-on-surface-variant transition-colors hover:bg-surface-container-high rounded-xl p-2 flex items-center justify-center w-10 h-10"
            title="Sair"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </header>

        {/* Desktop title / contextual topbar */}
        <header className="hidden md:flex justify-between items-center px-8 h-20 w-full bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-outline-variant shadow-none">
          <div className="flex flex-col">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#D12D6C] bg-[#FFEBF2] px-2.5 py-0.5 rounded-md mb-1 inline-block w-fit select-none">
              {activeTab === 'dashboard' ? 'Overview' : 
               activeTab === 'estoque' ? 'Estoque' : 
               activeTab === 'clientes' ? 'Clientes' : 
               activeTab === 'saidas' ? 'Vendas' : 
               activeTab === 'relatorios' ? 'Relatórios' : 
               activeTab === 'funcionarios' ? 'Equipe' : 
               activeTab === 'troca' ? 'Trocas' : activeTab}
            </span>
            <h1 className="text-xl font-black bg-gradient-to-r from-[#29141B] via-[#4A1E2C] to-[#D12D6C] bg-clip-text text-transparent tracking-tight leading-none">
              {activeTab === 'troca' ? 'Devoluções & Trocas' : 
               activeTab === 'saidas' ? 'Saídas & Vendas' : 
               activeTab === 'estoque' ? 'Estoque de Produtos' : 
               activeTab === 'dashboard' ? 'Visão Geral' : 
               activeTab === 'clientes' ? 'Gestão de Clientes' : 
               activeTab === 'funcionarios' ? 'Controle de Colaboradores' : 
               activeTab === 'relatorios' ? 'Relatório Geral' : activeTab}
            </h1>
            <p className="text-[10px] text-[#29141B]/60 font-semibold mt-1">
              {activeTab === 'dashboard' && "Métricas de faturamento e desempenho da loja em tempo real."}
              {activeTab === 'estoque' && "Gerenciamento de estoque de bolsas, preços de venda e alertas."}
              {activeTab === 'clientes' && "Cadastro de clientes, histórico de compras e contatos."}
              {activeTab === 'saidas' && "Registro de vendas e saídas de mercadorias do estoque."}
              {activeTab === 'relatorios' && "Relatórios financeiros consolidados de faturamento e trocas."}
              {activeTab === 'funcionarios' && "Gestão de acessos e permissões da equipe de colaboradores."}
              {activeTab === 'troca' && "Controle de devoluções de produtos e créditos de trocas."}
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Relógio e Data */}
            <div className="flex items-center gap-2 text-[#29141B]/55 text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px] text-[#29141B]/55">calendar_month</span>
              <span className="text-[#29141B]/75 font-medium text-[11px] tracking-tight">{getDataFormatada()}</span>
            </div>

            {/* Divisor vertical */}
            <div className="h-8 w-[1px] bg-[#29141B]/15" />
            
            {/* Perfil e Ações */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-[#29141B] tracking-tight">{profile?.nome}</span>
                <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border mt-0.5 transition-all duration-300 shadow-2xs ${
                  profile?.role === 'admin' 
                    ? 'bg-gradient-to-r from-[#D12D6C] to-[#FC5897] text-white border-transparent shadow-[0_2px_8px_rgba(209,45,108,0.15)]' 
                    : 'bg-[#FFEBF2] text-[#D12D6C] border-[#FAD6E5]'
                }`}>
                  {profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}
                </span>
              </div>
              
              {/* Avatar do Usuário com LED online */}
              <div className="relative group cursor-pointer select-none">
                <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-extrabold text-xs shadow-xs transition-all duration-300 ${
                  profile?.role === 'admin' 
                    ? 'bg-gradient-to-br from-[#D12D6C] to-[#FC5897] text-white border-transparent shadow-[0_2px_8px_rgba(209,45,108,0.15)]' 
                    : 'bg-[#FFEBF2] text-[#D12D6C] border-[#FAD6E5]'
                }`}>
                  {profile?.nome ? profile.nome.substring(0,2).toUpperCase() : "US"}
                </div>
                {/* LED de Status Online */}
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                </span>
              </div>

              {/* Botão Logout Rápido */}
              <button 
                onClick={handleLogout} 
                className="p-2 rounded-xl text-[#29141B]/50 hover:text-[#D12D6C] hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all duration-300"
                title="Sair do sistema"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content canvas */}
        <div className="p-container-padding md:p-8 flex flex-col gap-stack-md max-w-5xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              
              {/* ======================================================== */}
              {/* DASHBOARD PAGE                                           */}
              {/* ======================================================== */}
              {activeTab === "dashboard" && (
                <div className="flex flex-col gap-6">
                  
                  {/* 👥 Barra de Colaboradores Online (Inspirada no topo da Referência) */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#FCEEF3] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Botão de adicionar/convidar decorativo */}
                      {profile?.role === "admin" && (
                        <button 
                          onClick={() => setActiveTab("funcionarios")}
                          className="w-10 h-10 rounded-full border-2 border-dashed border-[#D12D6C]/35 text-[#D12D6C] flex items-center justify-center hover:bg-[#FFEBF2] hover:border-[#D12D6C] transition-all active:scale-95 shrink-0 cursor-pointer" 
                          title="Cadastrar Colaborador"
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                      )}
                      
                      {/* Avatares dos funcionários do sistema */}
                      <div className="flex items-center -space-x-2.5 overflow-hidden">
                        {funcionarios.map((func, index) => {
                          const coresAvatar = [
                            "bg-[#D12D6C] text-white",
                            "bg-[#FC5897] text-white",
                            "bg-[#5E464E] text-white",
                            "bg-[#B83A69] text-white",
                            "bg-[#FCA6C7] text-[#5E464E]"
                          ];
                          const cor = coresAvatar[index % coresAvatar.length];
                          return (
                            <div
                              key={func.id}
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white ${cor} relative shrink-0 select-none group cursor-pointer`}
                              title={func.nome}
                            >
                              {func.nome.substring(0, 2).toUpperCase()}
                              
                              {/* Bolinha verde de online */}
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                              
                              {/* Tooltip flutuante do nome do vendedor no hover */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                                <div className="bg-[#29141B] text-white text-[10px] font-bold py-1 px-2 rounded shadow-lg whitespace-nowrap">
                                  {func.nome} ({func.role === 'admin' ? 'Admin' : 'Funcionário'})
                                </div>
                                <div className="w-2 h-2 bg-[#29141B] rotate-45 -mt-1" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="hidden md:flex flex-col">
                        <span className="text-xs font-bold text-[#29141B]">Equipe Ativa</span>
                        <span className="text-[10px] text-[#29141B]/60">{funcionarios.length} colaboradores online</span>
                      </div>
                    </div>
                    
                    {/* Ferramentas do Timeframe & Ações (Interativos e Funcionais com Alta Legibilidade) */}
                    <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-end w-full sm:w-auto mt-2 sm:mt-0 z-30">
                      
                      {/* Chips de períodos rápidos do Dashboard */}
                      <div className="flex flex-wrap items-center gap-1.5 mr-2">
                        {[
                          { label: "Hoje", inicio: hojeStr, fim: hojeStr },
                          { label: "Ontem", inicio: ontemStr, fim: ontemStr },
                          { label: "Últimos 7 Dias", inicio: seteDiasStr, fim: hojeStr },
                          { label: "Este Mês", inicio: inicioMesStr, fim: hojeStr }
                        ].map((opcao) => {
                          const ativo = dashboardDataInicio === opcao.inicio && dashboardDataFim === opcao.fim;
                          return (
                            <button
                              key={opcao.label}
                              type="button"
                              onClick={() => {
                                setDashboardDataInicio(opcao.inicio);
                                setDashboardDataFim(opcao.fim);
                                // Sincroniza o dashboardDateFilter para o mês da data de início para manter o calendário correto
                                const dIni = new Date(opcao.inicio + "T12:00:00");
                                setDashboardDateFilter(dIni);
                                triggerToast(`Dashboard filtrado para: ${opcao.label}`);
                              }}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all duration-150 active:scale-95 border cursor-pointer ${
                                ativo 
                                  ? "bg-[#D12D6C] text-white border-[#D12D6C] shadow-sm" 
                                  : "bg-[#FCFAF9] border-[#FCEEF3] text-[#29141B]/60 hover:border-[#D12D6C] hover:text-[#D12D6C] hover:bg-[#FFEBF2]/40"
                              }`}
                            >
                              {opcao.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Badge Período Mensal (Interativo para resetar filtros) */}
                      <button 
                        onClick={() => {
                          const hoje = new Date();
                          setDashboardDateFilter(hoje);
                          setDashboardVendedorFilter("all");
                          
                          const targetYear = hoje.getFullYear();
                          const targetMonth = hoje.getMonth();
                          const startStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
                          const endStr = hoje.toISOString().split("T")[0];
                          
                          setDashboardDataInicio(startStr);
                          setDashboardDataFim(endStr);
                          triggerToast("Filtros do dashboard redefinidos para o mês atual!");
                        }}
                        className="bg-[#FCFAF9] hover:bg-[#FFEBF2] border border-[#EACAD6] hover:border-[#D12D6C] rounded-full py-1 px-3 flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow-sm group cursor-pointer" 
                        title="Clique para resetar filtros"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D12D6C] group-hover:scale-125 transition-transform shrink-0" />
                        <span className="text-[10px] sm:text-[11px] font-extrabold text-[#29141B]/75 uppercase tracking-wider group-hover:text-[#D12D6C]">Período Mensal</span>
                        {(dashboardDateFilter.getMonth() !== new Date().getMonth() || dashboardDateFilter.getFullYear() !== new Date().getFullYear() || dashboardVendedorFilter !== "all") && (
                          <span className="material-symbols-outlined text-[10px] text-[#D12D6C] font-bold animate-spin" style={{ animationIterationCount: 1, animationDuration: '1s' }}>restart_alt</span>
                        )}
                      </button>

                      {/* Botão de Timeframe seletor interativo */}
                      <div className="relative shrink-0">
                        <button 
                          onClick={() => { setShowMonthSelector(!showMonthSelector); setShowFilterDropdown(false); }}
                          className={`bg-white border ${showMonthSelector ? "border-[#D12D6C] ring-1 ring-[#D12D6C]" : "border-[#EACAD6]"} hover:border-[#D12D6C] text-[#29141B] py-1 px-3 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 group`}
                          title="Seletor de Período Mensal"
                        >
                          <span className="material-symbols-outlined text-xs sm:text-sm text-[#D12D6C] font-bold">calendar_today</span>
                          <span className="uppercase">{dashboardDateFilter.toLocaleString("pt-BR", { month: "long", year: "numeric" })}</span>
                          <span className="material-symbols-outlined text-[10px] text-[#29141B]/60">keyboard_arrow_down</span>
                        </button>
                        
                        {showMonthSelector && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setShowMonthSelector(false)} />
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#EACAD6] rounded-2xl shadow-xl z-30 p-2 flex flex-col gap-1 animate-fade-in">
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-[#29141B]/40 px-2 py-1">Selecionar Período</span>
                              {(() => {
                                const meses = [];
                                const hoje = new Date();
                                for (let i = 0; i < 6; i++) {
                                  const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
                                  meses.push(d);
                                }
                                return meses.map((m, idx) => {
                                  const isSelected = m.getMonth() === dashboardDateFilter.getMonth() && m.getFullYear() === dashboardDateFilter.getFullYear();
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        setDashboardDateFilter(m);
                                        setShowMonthSelector(false);
                                        
                                        const targetYear = m.getFullYear();
                                        const targetMonth = m.getMonth();
                                        const endOf = new Date(targetYear, targetMonth + 1, 0); // último dia do mês
                                        const startStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
                                        const endStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(endOf.getDate()).padStart(2, '0')}`;
                                        
                                        setDashboardDataInicio(startStr);
                                        setDashboardDataFim(endStr);
                                        triggerToast(`Dashboard atualizado para ${m.toLocaleString("pt-BR", { month: "long", year: "numeric" }).toUpperCase()}`);
                                      }}
                                      className={`text-left text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${isSelected ? "bg-[#FFEBF2] text-[#D12D6C]" : "text-[#29141B] hover:bg-[#FCFAF9]"}`}
                                    >
                                      {m.toLocaleString("pt-BR", { month: "long", year: "numeric" }).toUpperCase()}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Ícones de ação funcionais */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Botão de Filtro (Tune) */}
                        <div className="relative shrink-0">
                          <button 
                            onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowMonthSelector(false); }}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border ${dashboardVendedorFilter !== "all" || showFilterDropdown ? "border-[#D12D6C] bg-[#FFEBF2] text-[#D12D6C]" : "border-[#EACAD6] bg-white text-[#29141B]/75"} hover:border-[#D12D6C] hover:text-[#D12D6C] flex items-center justify-center transition-all shadow-sm active:scale-90 cursor-pointer group`} 
                            title="Filtrar por Colaborador"
                          >
                            <span className="material-symbols-outlined text-[14px] sm:text-base font-bold">tune</span>
                          </button>
                          
                          {showFilterDropdown && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setShowFilterDropdown(false)} />
                              <div className="absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 mt-2 w-56 bg-white border border-[#EACAD6] rounded-2xl shadow-xl z-30 p-2 flex flex-col gap-1 animate-fade-in">
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-[#29141B]/40 px-2 py-1">Filtrar por Vendedor</span>
                                <button
                                  onClick={() => {
                                    setDashboardVendedorFilter("all");
                                    setShowFilterDropdown(false);
                                    triggerToast("Exibindo vendas de toda a equipe");
                                  }}
                                  className={`text-left text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${dashboardVendedorFilter === "all" ? "bg-[#FFEBF2] text-[#D12D6C]" : "text-[#29141B] hover:bg-[#FCFAF9]"}`}
                                >
                                  👥 Todos os Vendedores
                                </button>
                                <div className="border-t border-[#FCEEF3] my-1" />
                                <div className="max-h-40 overflow-y-auto flex flex-col gap-1 pr-0.5">
                                  {funcionarios.map(f => {
                                    const isSelected = dashboardVendedorFilter === f.id;
                                    return (
                                      <button
                                        key={f.id}
                                        onClick={() => {
                                          setDashboardVendedorFilter(f.id);
                                          setShowFilterDropdown(false);
                                          triggerToast(`Faturamento filtrado para: ${f.nome}`);
                                        }}
                                        className={`text-left text-xs px-3 py-1.5 rounded-xl font-bold transition-all truncate cursor-pointer ${isSelected ? "bg-[#FFEBF2] text-[#D12D6C]" : "text-[#29141B] hover:bg-[#FCFAF9]"}`}
                                        title={f.nome}
                                      >
                                        👤 {f.nome}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Botão de Download */}
                        <button 
                          onClick={handleExportDashboard}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#EACAD6] hover:border-[#D12D6C] text-[#29141B]/75 hover:text-[#D12D6C] flex items-center justify-center transition-all bg-white shadow-sm active:scale-90 cursor-pointer" 
                          title="Exportar Vendas em CSV"
                        >
                          <span className="material-symbols-outlined text-[14px] sm:text-base font-bold">download</span>
                        </button>

                        {/* Botão de Compartilhar */}
                        <button 
                          onClick={handleShareDashboard}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#EACAD6] hover:border-[#D12D6C] text-[#29141B]/75 hover:text-[#D12D6C] flex items-center justify-center transition-all bg-white shadow-sm active:scale-90 cursor-pointer" 
                          title="Copiar Resumo do Dashboard"
                        >
                          <span className="material-symbols-outlined text-[14px] sm:text-base font-bold">share</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 📊 Seção Hero Analytics: Revenue + Calendário */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Painel de Faturamento e Gráficos (Esquerda - Ocupa 2 colunas no desktop) */}
                    <div className="xl:col-span-2 bg-white rounded-[24px] p-6 shadow-sm border border-[#FCEEF3] flex flex-col gap-6">
                      
                      {/* Cabeçalho do Faturamento */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-[#D12D6C]">{dashboardPeriodoInfo.label}</span>
                          <h2 className="text-3xl md:text-4xl font-extrabold text-[#29141B] tracking-tight font-headline-lg flex flex-wrap items-baseline gap-2">
                            R$ {dashboardStats.totalFaturadoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            <span className="text-xs font-bold text-[#D12D6C] bg-[#FFEBF2] py-0.5 px-2 rounded-full inline-flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[10px] font-bold">trending_up</span>
                              +{dashboardStats.qtdVendasMes} {dashboardStats.qtdVendasMes === 1 ? 'venda' : 'vendas'}
                            </span>
                          </h2>
                          <p className="text-[10px] text-[#29141B]/50 font-medium">{dashboardPeriodoInfo.desc}</p>
                        </div>

                        {/* Detalhes de faturamento do dia de hoje decorativo */}
                        <div className="bg-[#FCFAF9] rounded-xl p-3 border border-[#FCEEF3] sm:text-right flex flex-col justify-center shrink-0 w-max">
                          <span className="text-[9px] font-extrabold text-[#D12D6C] uppercase tracking-wider">Hoje</span>
                          <span className="text-lg font-extrabold text-emerald-600">R$ {dashboardStats.faturamentoHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          <span className="text-[8px] text-[#29141B]/60 font-semibold">{dashboardStats.qtdVendasHoje} {dashboardStats.qtdVendasHoje === 1 ? 'venda' : 'vendas'}</span>
                        </div>
                      </div>

                      {/* 📈 Gráfico SVG de Tendência (Sales dynamic dos últimos 7 dias) */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between border-b border-[#FCEEF3] pb-2">
                          <span className="text-xs font-bold text-[#29141B] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D12D6C] animate-ping" />
                            Tendência Semanal (Sales dynamic)
                          </span>
                          <span className="text-[9px] text-[#29141B]/60 font-semibold">Últimos 7 dias de vendas</span>
                        </div>

                        {/* Espaço do Gráfico SVG */}
                        <div className="h-32 w-full relative mt-3 select-none">
                          {(() => {
                            const maxVal = Math.max(...dadosGrafico7Dias.map(d => d.total), 100);
                            
                            // Mapear pontos para o SVG
                            const points = dadosGrafico7Dias.map((d, i) => {
                              const x = (i / 6) * 100;
                              const y = 100 - (d.total / maxVal) * 75 - 10; // Deixa margem
                              return { x, y, data: d };
                            });

                            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                            const fillD = `${pathD} L 100 100 L 0 100 Z`;

                            return (
                              <>
                                {/* SVG Responsivo */}
                                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                  <defs>
                                    <linearGradient id="gradient-rosa-grafico" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#D12D6C" stopOpacity="0.3" />
                                      <stop offset="100%" stopColor="#D12D6C" stopOpacity="0.00" />
                                    </linearGradient>
                                  </defs>
                                  
                                  {/* Grid Lines Horizontais */}
                                  <line x1="0" y1="20" x2="100" y2="20" stroke="#FCEEF3" strokeWidth="0.3" strokeDasharray="1,1" />
                                  <line x1="0" y1="50" x2="100" y2="50" stroke="#FCEEF3" strokeWidth="0.3" strokeDasharray="1,1" />
                                  <line x1="0" y1="80" x2="100" y2="80" stroke="#FCEEF3" strokeWidth="0.3" strokeDasharray="1,1" />

                                  {/* Área Sombreada com Degradê */}
                                  <path d={fillD} fill="url(#gradient-rosa-grafico)" />
                                  
                                  {/* Linha Contínua Rosa */}
                                  <path d={pathD} fill="none" stroke="#D12D6C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                                </svg>

                                {/* Grade de Botões Circulares Interativos (Hover com Tooltip) */}
                                <div className="absolute inset-0 w-full h-full">
                                  {points.map((p, i) => {
                                    return (
                                      <div
                                        key={i}
                                        style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 cursor-pointer"
                                      >
                                        {/* Ponto Visual */}
                                        <div className="w-2.5 h-2.5 rounded-full bg-white border-[2.5px] border-[#D12D6C] shadow-sm hover:scale-125 transition-transform" />
                                        
                                        {/* Tooltip Absoluto no Hover */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 drop-shadow-md">
                                          <div className="bg-[#29141B] text-white text-[9px] p-2 rounded-xl leading-normal border border-[#FCEEF3]/20 shadow-xl whitespace-nowrap">
                                            <p className="font-extrabold text-[#FC5897]">{p.data.label}</p>
                                            <p className="font-bold">Faturamento: <span className="text-emerald-400">R$ {p.data.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></p>
                                            <p className="text-[#FC5897]/80">{p.data.quantidade} {p.data.quantidade === 1 ? 'venda' : 'vendas'}</p>
                                          </div>
                                          <div className="w-2.5 h-2.5 bg-[#29141B] rotate-45 -mt-1.5" />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Legendas dos dias do gráfico */}
                        <div className="grid grid-cols-7 text-center text-[9px] font-bold text-[#29141B]/40 uppercase tracking-widest mt-1 border-t border-[#FCEEF3] pt-1.5">
                          {dadosGrafico7Dias.map((d, i) => (
                            <span key={i} className="first:text-left last:text-right first:translate-x-0 last:translate-x-0 truncate">
                              {d.label.split(" ")[0]} {d.diaAbrev}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 📊 Barra Horizontal Segmentada de Contribuição dos Vendedores */}
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center justify-between border-b border-[#FCEEF3] pb-1.5">
                          <span className="text-xs font-bold text-[#29141B] uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-[#D12D6C]">analytics</span>
                            Fatia de Vendas da Equipe (Team Share)
                          </span>
                          <span className="text-[9px] text-[#29141B]/60 font-semibold">Percentual de faturamento no período</span>
                        </div>

                        {(() => {
                          const vendedoresComVendas = rankingVendedores.filter(v => v.total > 0);
                          const faturamentoTotalEquipe = vendedoresComVendas.reduce((acc, v) => acc + v.total, 0) || 1;
                          
                          const coresAvatar = [
                            "bg-[#D12D6C]",
                            "bg-[#FC5897]",
                            "bg-[#5E464E]",
                            "bg-[#B83A69]",
                            "bg-[#FCA6C7]",
                            "bg-[#E2C2CD]"
                          ];

                          return (
                            <div className="flex flex-col gap-3">
                              {/* Barra Multi-Segmentada */}
                              <div className="w-full h-3.5 bg-[#FCFAF9] rounded-full overflow-hidden flex border border-[#FCEEF3] shadow-inner">
                                {vendedoresComVendas.map((v, i) => {
                                  const pct = (v.total / faturamentoTotalEquipe) * 100;
                                  const cor = coresAvatar[i % coresAvatar.length];
                                  return (
                                    <div
                                      key={v.id}
                                      style={{ width: `${pct}%` }}
                                      className={`${cor} h-full transition-all duration-500 hover:opacity-90 relative group cursor-pointer`}
                                      title={`${v.nome}: ${pct.toFixed(1)}%`}
                                    >
                                      {/* Tooltip flutuante rápido */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                                        <div className="bg-[#29141B] text-white text-[8px] font-bold py-1 px-1.5 rounded shadow-lg whitespace-nowrap">
                                          {v.nome}: {pct.toFixed(1)}%
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {vendedoresComVendas.length === 0 && (
                                  <div className="w-full h-full bg-[#FCFAF9] text-[#29141B]/40 text-[9px] font-bold flex items-center justify-center">
                                    Aguardando as primeiras vendas do período
                                  </div>
                                )}
                              </div>

                              {/* Legendas dos Vendedores da Equipe */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {vendedoresComVendas.slice(0, 4).map((v, i) => {
                                  const pct = (v.total / faturamentoTotalEquipe) * 100;
                                  const cor = coresAvatar[i % coresAvatar.length];
                                  return (
                                    <div key={v.id} className="flex items-center gap-2 bg-[#FCFAF9] border border-[#FCEEF3] p-1.5 rounded-lg">
                                      <div className={`w-3.5 h-3.5 rounded-full ${cor} shrink-0`} />
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-[9px] font-bold text-[#29141B] truncate">{v.nome}</span>
                                        <span className="text-[8px] text-[#29141B]/60 font-semibold">{pct.toFixed(1)}% ({v.quantidade} un)</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* 📅 Calendário Interativo Redesenhado em Tema Claro & Rosa (Direita) */}
                    <div className="xl:col-span-1 bg-white rounded-[24px] p-5 shadow-sm border border-[#FCEEF3] flex flex-col justify-between select-none min-h-[360px]">
                      
                      {/* Lado Esquerdo: Resumo do Dia Selecionado */}
                      <div className="flex flex-col gap-1 border-b border-[#FCEEF3] pb-3 mb-3">
                        <span className="text-[9px] text-[#D12D6C] font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D12D6C] animate-pulse" />
                          {(() => {
                            const hoje = new Date();
                            const sel = dataSelecionada;
                            const eHoje = sel.getDate() === hoje.getDate() &&
                                          sel.getMonth() === hoje.getMonth() &&
                                          sel.getFullYear() === hoje.getFullYear();
                            return eHoje ? "Faturamento de Hoje" : `Faturamento em ${sel.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
                          })()}
                        </span>
                        
                        {/* Faturamento em Rosa Framboesa Gigante */}
                        <div className={`font-display-price text-3xl font-extrabold tracking-tight mt-1 font-display-price ${
                          (() => {
                            const hoje = new Date();
                            const sel = dataSelecionada;
                            return sel.getDate() === hoje.getDate() &&
                                   sel.getMonth() === hoje.getMonth() &&
                                   sel.getFullYear() === hoje.getFullYear();
                          })() ? "text-emerald-600" : "text-[#D12D6C]"
                        }`}>
                          R$ {(() => {
                            const ano = dataSelecionada.getFullYear();
                            const mes = String(dataSelecionada.getMonth() + 1).padStart(2, '0');
                            const dia = String(dataSelecionada.getDate()).padStart(2, '0');
                            const chave = `${ano}-${mes}-${dia}`;
                            const dados = faturamentoPorDia[chave] || { total: 0, quantidade: 0 };
                            return dados.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                          })()}
                        </div>
                        
                        <div className="text-[10px] text-[#29141B]/60 font-semibold mt-0.5">
                          {(() => {
                            const ano = dataSelecionada.getFullYear();
                            const mes = String(dataSelecionada.getMonth() + 1).padStart(2, '0');
                            const dia = String(dataSelecionada.getDate()).padStart(2, '0');
                            const chave = `${ano}-${mes}-${dia}`;
                            const dados = faturamentoPorDia[chave] || { total: 0, quantidade: 0 };
                            return `${dados.quantidade} ${dados.quantidade === 1 ? "venda realizada" : "vendas realizadas"}`;
                          })()}
                        </div>
                      </div>

                      {/* Mini Calendário */}
                      <div className="flex flex-col gap-2 bg-[#FCFAF9] border border-[#FCEEF3] p-3 rounded-xl">
                        
                        {/* Seletor de Mês/Ano */}
                        <div className="flex items-center justify-between border-b border-[#FCEEF3] pb-1.5 mb-1.5">
                          <button
                            onClick={() => {
                              setMesAnoExibido(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                            }}
                            className="p-1 hover:bg-[#FCEEF3] rounded-full transition-colors text-[#D12D6C] active:scale-90"
                            title="Mês Anterior"
                          >
                            <span className="material-symbols-outlined text-sm leading-none font-bold">chevron_left</span>
                          </button>
                          
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#29141B]/75">
                            {mesAnoExibido.toLocaleString("pt-BR", { month: "short", year: "numeric" }).replace(".", "")}
                          </span>

                          <button
                            onClick={() => {
                              setMesAnoExibido(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                            }}
                            className="p-1 hover:bg-[#FCEEF3] rounded-full transition-colors text-[#D12D6C] active:scale-90"
                            title="Próximo Mês"
                          >
                            <span className="material-symbols-outlined text-sm leading-none font-bold">chevron_right</span>
                          </button>
                        </div>

                        {/* Dias da Semana */}
                        <div className="grid grid-cols-7 text-center gap-1 text-[8px] font-bold tracking-widest text-[#29141B]/40 uppercase">
                          <span>D</span>
                          <span>S</span>
                          <span>T</span>
                          <span>Q</span>
                          <span>Q</span>
                          <span>S</span>
                          <span>S</span>
                        </div>

                        {/* Grade do Calendário */}
                        <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-center">
                          {diasDoCalendario.map((d, index) => {
                            if (d.dia === null) {
                              return <div key={`empty-${index}`} className="w-6 h-6" />;
                            }

                            const hoje = new Date();
                            const eHoje = d.dia === hoje.getDate() && 
                                          mesAnoExibido.getMonth() === hoje.getMonth() && 
                                          mesAnoExibido.getFullYear() === hoje.getFullYear();
                            
                            const eSelecionado = d.dia === dataSelecionada.getDate() &&
                                                 mesAnoExibido.getMonth() === dataSelecionada.getMonth() &&
                                                 mesAnoExibido.getFullYear() === dataSelecionada.getFullYear();
                            
                            const temFaturamento = d.faturamento > 0;

                            return (
                              <button
                                key={`day-${d.dia}`}
                                onClick={() => {
                                  setDataSelecionada(d.dateObj);
                                  const anoVal = d.dateObj.getFullYear();
                                  const mesVal = String(d.dateObj.getMonth() + 1).padStart(2, '0');
                                  const diaVal = String(d.dateObj.getDate()).padStart(2, '0');
                                  const dataStr = `${anoVal}-${mesVal}-${diaVal}`;
                                  setDashboardDataInicio(dataStr);
                                  setDashboardDataFim(dataStr);
                                  triggerToast(`Dashboard filtrado para o dia ${diaVal}/${mesVal}/${anoVal}`);
                                }}
                                title={`${d.dia}/${mesAnoExibido.getMonth()+1} - Faturamento: R$ ${d.faturamento.toFixed(2)}`}
                                className={`w-6 h-6 mx-auto flex items-center justify-center rounded-full transition-all relative group active:scale-90 ${
                                  eSelecionado
                                    ? "bg-[#D12D6C] text-white font-extrabold ring-2 ring-[#D12D6C]/30 ring-offset-1 ring-offset-white shadow-md shadow-[#D12D6C]/25"
                                    : temFaturamento
                                      ? "bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-200/50 hover:bg-emerald-100"
                                      : eHoje
                                        ? "bg-[#FC5897]/10 text-[#FC5897] border border-[#FC5897]/30 hover:bg-[#FC5897]/20"
                                        : "text-[#29141B]/75 hover:bg-[#FCEEF3] hover:text-[#D12D6C]"
                                }`}
                              >
                                {d.dia}
                                
                                {/* Bolinha verde discreta representando dinheiro entrando no caixa */}
                                {temFaturamento && !eSelecionado && (
                                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />
                                )}
                                
                                {/* Tooltip Flutuante no Hover */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-30 drop-shadow-md">
                                  <div className="bg-[#29141B] border border-[#FCEEF3]/20 rounded-xl py-1.5 px-2 text-[8px] text-white whitespace-nowrap shadow-xl leading-tight">
                                    <p className="font-extrabold text-emerald-400">R$ {d.faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                    <p className="text-[#FC5897]/80">{d.quantidade} {d.quantidade === 1 ? "venda" : "vendas"}</p>
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-[#29141B] rotate-45 -mt-1" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Botão de Retorno Rápido a Hoje se estiver visualizando outro dia */}
                      {(() => {
                        const hoje = new Date();
                        const sel = dataSelecionada;
                        const eHoje = sel.getDate() === hoje.getDate() &&
                                      sel.getMonth() === hoje.getMonth() &&
                                      sel.getFullYear() === hoje.getFullYear();
                        return !eHoje ? (
                          <button
                            onClick={() => {
                              const hoje = new Date();
                              setDataSelecionada(hoje);
                              setMesAnoExibido(hoje);
                              const hojeStr = hoje.toISOString().split("T")[0];
                              setDashboardDataInicio(hojeStr);
                              setDashboardDataFim(hojeStr);
                              triggerToast("Dashboard redefinido para o dia de Hoje!");
                            }}
                            className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#D12D6C] bg-[#FFEBF2] border border-[#D12D6C]/20 hover:bg-[#D12D6C] hover:text-white transition-all py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 w-full active:scale-98 text-xs font-semibold"
                          >
                            <span className="material-symbols-outlined text-[14px] font-bold">today</span>
                            Voltar para Hoje
                          </button>
                        ) : (
                          <div className="h-[2px]" />
                        );
                      })()}
                    </div>
                  </div>

                  {/* 📦 Bento Grid Stats (Inspirado no visual premium da referência) */}
                  <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Products Registered */}
                    <div 
                      onClick={() => { setActiveTab("estoque"); setFilterStatus("all"); }}
                      className="bg-white border border-[#EACAD6] hover:border-[#D12D6C] rounded-[20px] p-4 shadow-md shadow-[#29141B]/[0.03] hover:shadow-xl hover:shadow-[#D12D6C]/5 flex flex-col justify-between min-h-[100px] transition-all hover:-translate-y-1 duration-300 cursor-pointer active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-[#29141B]/75 uppercase tracking-widest group-hover:text-[#D12D6C]">Estoque</span>
                        <span className="material-symbols-outlined text-sm text-[#D12D6C] bg-[#FFEBF2] border border-[#D12D6C]/10 p-1.5 rounded-xl shadow-sm group-hover:scale-110 transition-transform">category</span>
                      </div>
                      <div className="mt-2">
                        <div className="text-2xl font-extrabold text-[#29141B] tracking-tight">{bolsas.length} <span className="text-[10px] text-[#29141B]/75 font-black uppercase tracking-wider">Modelos</span></div>
                        <div className="mt-1">
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200/50 font-extrabold py-0.5 px-2 rounded-full inline-flex items-center gap-1 shadow-sm">
                            🟢 {dashboardStats.totalDisponiveis} bolsas em estoque
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sales count */}
                    <div 
                      onClick={() => setActiveTab("saidas")}
                      className="bg-white border border-[#EACAD6] hover:border-[#FC5897] rounded-[20px] p-4 shadow-md shadow-[#29141B]/[0.03] hover:shadow-xl hover:shadow-[#FC5897]/5 flex flex-col justify-between min-h-[100px] transition-all hover:-translate-y-1 duration-300 cursor-pointer active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-[#29141B]/75 uppercase tracking-widest group-hover:text-[#FC5897]">Vendas</span>
                        <span className="material-symbols-outlined text-sm text-[#FC5897] bg-[#FC5897]/10 border border-[#FC5897]/20 p-1.5 rounded-xl shadow-sm group-hover:scale-110 transition-transform">sell</span>
                      </div>
                      <div className="mt-2">
                        <div className="text-2xl font-extrabold text-[#29141B] tracking-tight">{vendas.length} <span className="text-[10px] text-[#29141B]/75 font-black uppercase tracking-wider">Registradas</span></div>
                        <div className="mt-1">
                          <span className="text-[9px] bg-[#29141B]/[0.04] text-[#29141B]/80 font-black py-0.5 px-2 rounded-full inline-flex items-center gap-1 border border-[#29141B]/10 shadow-sm">
                            📊 Acumulado histórico
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Clientes */}
                    <div 
                      onClick={() => setActiveTab("clientes")}
                      className="bg-white border border-[#EACAD6] hover:border-[#5E464E] rounded-[20px] p-4 shadow-md shadow-[#29141B]/[0.03] hover:shadow-xl hover:shadow-[#5E464E]/5 flex flex-col justify-between min-h-[100px] transition-all hover:-translate-y-1 duration-300 cursor-pointer active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-[#29141B]/75 uppercase tracking-widest group-hover:text-[#5E464E]">Clientes</span>
                        <span className="material-symbols-outlined text-sm text-[#5E464E] bg-[#5E464E]/10 border border-[#5E464E]/20 p-1.5 rounded-xl shadow-sm group-hover:scale-110 transition-transform">group</span>
                      </div>
                      <div className="mt-2">
                        <div className="text-2xl font-extrabold text-[#29141B] tracking-tight">{clientes.length} <span className="text-[10px] text-[#29141B]/75 font-black uppercase tracking-wider">Ativos</span></div>
                        <div className="mt-1">
                          <span className="text-[9px] bg-[#29141B]/[0.04] text-[#29141B]/80 font-black py-0.5 px-2 rounded-full inline-flex items-center gap-1 border border-[#29141B]/10 shadow-sm">
                            👥 Base cadastrada
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Low Stock Alert - Design Ultra Chamativo com Gradiente Premium e Alto Contraste */}
                    <div 
                      onClick={() => { setActiveTab("estoque"); setFilterStatus("baixo_estoque"); }}
                      className="bg-gradient-to-br from-[#D12D6C] via-[#DC5345] to-[#E29D24] border border-[#D12D6C]/40 hover:border-[#D12D6C] rounded-[20px] p-4 shadow-md hover:shadow-xl shadow-[#D12D6C]/10 flex flex-col justify-between min-h-[100px] transition-all duration-300 cursor-pointer hover:-translate-y-1 active:scale-[0.98] relative overflow-hidden group"
                    >
                      {/* Efeito de brilho de fundo interativo */}
                      <div className="absolute -inset-10 bg-gradient-to-r from-transparent via-white/20 to-transparent -rotate-45 translate-x-[-100%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-out" />
                      
                      <div className="flex items-center justify-between relative z-10">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest bg-black/20 py-0.5 px-2 rounded-full flex items-center gap-1 animate-pulse">
                          ⚠️ Atenção
                        </span>
                        <span className="material-symbols-outlined text-sm text-[#D12D6C] bg-white p-1.5 rounded-xl shadow-sm animate-bounce" style={{ animationDuration: '2s' }}>
                          warning
                        </span>
                      </div>
                      
                      <div className="mt-2 relative z-10">
                        <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1">
                          {dashboardStats.alertasEstoque.length} 
                          <span className="text-[10px] text-white/90 font-black uppercase tracking-wider">
                            {dashboardStats.alertasEstoque.length === 1 ? 'Produto' : 'Produtos'}
                          </span>
                        </div>
                        <div className="text-[10px] text-white font-bold tracking-wide mt-1 flex items-center gap-1">
                          Abaixo do estoque mínimo
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* 🏆 Ranking de Vendas por Vendedor */}
                  <section className="bg-white border border-[#EACAD6] rounded-[24px] p-6 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-[#FCEEF3] pb-3">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#D12D6C] text-2xl font-bold">trophy</span>
                        <div>
                          <h2 className="font-headline-md text-headline-md text-[#29141B] font-bold">Ranking de Vendas</h2>
                          <p className="font-body-sm text-body-sm text-[#29141B]/60">Desempenho financeiro acumulado por colaborador ativo.</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch pt-2">
                      {rankingVendedores.slice(0, 3).map((vend, idx) => {
                        const cardStyles = [
                          // 1º Lugar (Rose Gold & Gold Sparkle Premium)
                          "bg-gradient-to-br from-[#FFF5F8] via-white to-[#FFFDF0]/60 border-2 border-[#D12D6C] shadow-lg shadow-[#D12D6C]/8 scale-[1.03] sm:scale-[1.04] z-10 hover:scale-[1.06] sm:hover:scale-[1.07]",
                          // 2º Lugar (Rosa Prateado Elegante)
                          "bg-gradient-to-br from-[#F8F9FA] via-white to-[#FFEBF2]/20 border border-[#EACAD6] shadow-sm hover:scale-[1.02]",
                          // 3º Lugar (Rosa Bronze Sutil)
                          "bg-gradient-to-br from-[#FAF8F7] via-white to-[#FCEEF3]/20 border border-[#FCEEF3] shadow-sm hover:scale-[1.02]"
                        ];

                        const badgeStyles = [
                          "bg-gradient-to-r from-[#D12D6C] via-[#FC5897] to-[#F2C94C] text-white border-transparent shadow-[0_4px_12px_rgba(209,45,108,0.3)]",
                          "bg-gradient-to-r from-[#9E9E9E] to-[#D12D6C]/80 text-white border-transparent shadow-[0_3px_10px_rgba(158,158,158,0.25)]",
                          "bg-gradient-to-r from-[#CD7F32]/80 to-[#D12D6C]/70 text-white border-transparent shadow-[0_2px_8px_rgba(205,127,50,0.2)]"
                        ];

                        const avatarStyles = [
                          "border-[#D12D6C] text-[#D12D6C] bg-[#FFF5F8] ring-4 ring-[#D12D6C]/10",
                          "border-[#EACAD6] text-[#D12D6C]/90 bg-[#F8F9FA] ring-2 ring-[#EACAD6]/20",
                          "border-[#FCEEF3] text-[#D12D6C]/85 bg-[#FAF8F7]"
                        ];

                        const medalColors = ["text-[#F2C94C]", "text-[#9E9E9E]", "text-[#CD7F32]"];
                        const medalIcons = ["emoji_events", "military_tech", "military_tech"];
                        const positionLabels = ["1º Colocado", "2º Colocado", "3º Colocado"];
                        
                        if (vend.total === 0 && vend.quantidade === 0) return null;

                        return (
                          <div 
                            key={vend.id} 
                            className={`relative rounded-3xl border p-5 flex flex-col items-center text-center justify-between transition-all duration-300 hover:shadow-xl ${cardStyles[idx]}`}
                          >
                            {/* Position Badge */}
                            <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-md flex items-center gap-1.5 ${badgeStyles[idx]}`}>
                              <span className={`material-symbols-outlined text-xs ${idx === 0 ? "animate-bounce" : ""}`}>{medalIcons[idx]}</span>
                              {positionLabels[idx]}
                            </div>

                            <div className="mt-4 flex flex-col items-center gap-2.5">
                              {/* Avatar */}
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-lg border-2 ${avatarStyles[idx]}`}>
                                {vend.nome.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-extrabold text-sm text-[#29141B] flex items-center gap-1 justify-center">
                                  {vend.nome}
                                  {idx === 0 && (
                                    <span className="material-symbols-outlined text-base text-[#F2C94C] drop-shadow-sm select-none">stars</span>
                                  )}
                                </span>
                                <span className="text-[10px] text-[#29141B]/60 font-semibold uppercase tracking-wider mt-0.5">{vend.role === 'admin' ? 'Administrador' : 'Colaborador'}</span>
                              </div>
                            </div>

                            <div className="mt-5 w-full border-t border-[#FCEEF3] pt-4 flex flex-col items-center">
                              <span className={`font-mono block ${idx === 0 ? "text-2xl font-black text-emerald-600 scale-105" : "text-xl font-extrabold text-emerald-600"}`}>
                                R$ {vend.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-[#29141B]/60 font-bold uppercase tracking-wider mt-1">
                                {vend.quantidade} {vend.quantidade === 1 ? "venda" : "vendas"} realizada(s)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {rankingVendedores.filter(v => v.total > 0).length === 0 && (
                        <div className="col-span-3 py-6 text-center text-[#29141B]/50 text-xs">
                          Ainda não há vendas registradas para montar o pódio.
                        </div>
                      )}
                    </div>

                    {/* Tabela Completa do Ranking (caso existam mais de 3 funcionários) */}
                    {rankingVendedores.length > 3 && (
                      <div className="mt-2 overflow-x-auto border border-[#EACAD6] rounded-xl">
                        <table className="w-full text-xs border-collapse text-left bg-[#FCFAF9]">
                          <thead>
                            <tr className="bg-white border-b border-[#FCEEF3] text-[9px] font-label-bold uppercase tracking-widest text-[#29141B]/60">
                              <th className="p-3 w-12 text-center">Pos.</th>
                              <th className="p-3">Vendedor</th>
                              <th className="p-3 text-right">Faturamento Total</th>
                              <th className="p-3 hidden lg:table-cell">Cargo</th>
                              <th className="p-3 text-center hidden sm:table-cell">Qtd. Vendida</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rankingVendedores.map((vend, idx) => (
                              <tr key={vend.id} className="border-b border-[#FCEEF3] hover:bg-[#FFEBF2]/10 transition-colors">
                                <td className="p-3 font-extrabold text-center text-[#29141B]/60">
                                  {idx + 1}º
                                </td>
                                <td className="p-3 font-bold text-[#29141B]">
                                  {vend.nome}
                                </td>
                                <td className="p-3 text-right font-extrabold text-emerald-600">
                                  R$ {vend.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-[#29141B]/60 capitalize hidden lg:table-cell">
                                  {vend.role === 'admin' ? 'Administrador' : 'Colaborador'}
                                </td>
                                <td className="p-3 text-center text-[#29141B] font-semibold hidden sm:table-cell">
                                  {vend.quantidade} un
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* Stock Status Lists Grid (Attention vs General) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Attention Products List (Col 1) */}
                    <section className="flex flex-col gap-3">
                      <h2 className="font-headline-md text-headline-md text-[#29141B] border-b border-[#FCEEF3] pb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#D12D6C] text-xl">warning</span>
                        Produtos em Alerta (Baixo Estoque)
                      </h2>
                      <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                        {dashboardStats.alertasEstoque.map(p => (
                          <div 
                            key={p.id} 
                            className="bg-white border border-[#FCEEF3] rounded-xl p-3.5 shadow-sm flex items-center justify-between hover:bg-[#FFEBF2]/30 hover:border-[#D12D6C]/30 transition-all cursor-pointer active:scale-[0.98]"
                            onClick={() => { setActiveTab("estoque"); setSearchQuery(p.codigo); }}
                            title="Clique para ver no estoque"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#FCFAF9] rounded-xl flex items-center justify-center shrink-0 border border-[#FCEEF3]">
                                {p.foto_url ? (
                                  <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  <span className="material-symbols-outlined text-[#29141B]/60">apparel</span>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs text-[#29141B] leading-tight">{p.nome}</span>
                                <span className="text-[10px] text-[#29141B]/60">{p.codigo}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[#D12D6C] font-extrabold">{p.quantidade} un</span>
                              <span className="material-symbols-outlined text-xs text-[#29141B]/30">chevron_right</span>
                            </div>
                          </div>
                        ))}
                        {dashboardStats.alertasEstoque.length === 0 && (
                          <div className="bg-white border border-[#FCEEF3] rounded-xl p-10 text-center text-[#29141B]/60 text-xs">
                            Nenhum produto abaixo do estoque mínimo. Todo o inventário está abastecido!
                          </div>
                        )}
                      </div>
                    </section>

                    {/* General Stock Overview List (Col 2) */}
                    <section className="flex flex-col gap-3">
                      <h2 className="font-headline-md text-headline-md text-[#29141B] border-b border-[#FCEEF3] pb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#5E464E] text-xl">inventory_2</span>
                        Visão Geral do Estoque
                      </h2>
                      <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                        {bolsas.map(p => {
                          const isLow = p.quantidade <= Math.max(Number(p.quantidade_minima || 0), 2);
                          return (
                            <div 
                              key={p.id} 
                              className="bg-white border border-[#FCEEF3] rounded-xl p-3.5 shadow-sm flex items-center justify-between hover:bg-[#FFEBF2]/20 hover:border-[#D12D6C]/20 transition-all cursor-pointer active:scale-[0.98]"
                              onClick={() => { setActiveTab("estoque"); setSearchQuery(p.codigo); }}
                              title="Clique para ver no estoque"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#FCFAF9] rounded-xl flex items-center justify-center shrink-0 border border-[#FCEEF3]">
                                  {p.foto_url ? (
                                    <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover rounded-xl" />
                                  ) : (
                                    <span className="material-symbols-outlined text-[#29141B]/60">apparel</span>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs text-[#29141B] leading-tight">{p.nome}</span>
                                  <span className="text-[10px] text-[#29141B]/60">{p.codigo}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-extrabold ${isLow ? "text-[#D12D6C]" : "text-[#29141B]"}`}>{p.quantidade} un</span>
                                <span className="material-symbols-outlined text-xs text-[#29141B]/30">chevron_right</span>
                              </div>
                            </div>
                          );
                        })}
                        {bolsas.length === 0 && (
                          <div className="bg-white border border-[#FCEEF3] rounded-xl p-10 text-center text-[#29141B]/60 text-xs">
                            Nenhum produto cadastrado no estoque.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* ESTOQUE PAGE                                             */}
              {/* ======================================================== */}
              {activeTab === "estoque" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Left Column: Register Form */}
                  <div className="lg:col-span-1 flex flex-col gap-6">
                    <section className="bg-white rounded-[24px] border border-[#FCEEF3] shadow-sm p-6 flex flex-col gap-6 relative overflow-hidden">
                      {profile?.role !== "admin" && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-6 text-center gap-3">
                          <span className="material-symbols-outlined text-4xl text-[#D12D6C]">lock</span>
                          <p className="text-sm text-[#29141B] font-extrabold leading-normal">Área Restrita</p>
                          <p className="text-xs text-[#29141B]/60 leading-relaxed">Apenas Administradores podem cadastrar produtos no estoque.</p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 border-b border-[#FCEEF3] pb-3">
                        <span className="material-symbols-outlined text-[#D12D6C] text-2xl">
                          {editingBolsa ? "edit" : "add_box"}
                        </span>
                        <h2 className="text-xl font-extrabold text-[#29141B]">
                          {editingBolsa ? "Editar Produto" : "Cadastrar Produto"}
                        </h2>
                      </div>
                      
                      {/* Intelligent Capture Trigger */}
                      <div className="flex flex-col gap-3 text-center items-center justify-center p-3 bg-[#FCFAF9] border border-[#EACAD6] rounded-2xl shadow-sm">
                        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#29141B]/75">Captura Inteligente</span>
                        <div className="grid grid-cols-3 gap-1.5 w-full">
                          <label className="w-full bg-white hover:bg-[#29141B]/[0.03] text-[#29141B] border border-[#EACAD6] hover:border-[#29141B]/50 rounded-xl h-10 text-[10px] font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm">
                            <span className="material-symbols-outlined text-base text-[#D12D6C]">photo_camera</span>
                            Câmera
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment" 
                              onChange={handlePhotoCapture} 
                              className="hidden" 
                            />
                          </label>
                          <label className="w-full bg-white hover:bg-[#29141B]/[0.03] text-[#29141B] border border-[#EACAD6] hover:border-[#29141B]/50 rounded-xl h-10 text-[10px] font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm">
                            <span className="material-symbols-outlined text-base text-[#D12D6C]">image</span>
                            Galeria
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handlePhotoCapture} 
                              className="hidden" 
                            />
                          </label>
                          <button 
                            type="button" 
                            onClick={startScanner} 
                            className="w-full bg-white hover:bg-[#29141B]/[0.03] text-[#29141B] border border-[#EACAD6] hover:border-[#29141B]/50 rounded-xl h-10 text-[10px] font-extrabold flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-base text-[#D12D6C]">qr_code_scanner</span>
                            Leitor
                          </button>
                        </div>
                        {cameraUploading && <span className="text-[10px] text-[#D12D6C] animate-pulse">Enviando foto ao Supabase...</span>}
                        {ocrLoading && <span className="text-[10px] text-emerald-600 animate-pulse">Lendo etiqueta com Tesseract...</span>}
                          
                          {formBolsa.foto_url && (
                            <div className="w-full h-32 bg-[#FCFAF9] rounded-xl overflow-hidden border border-[#EACAD6] mt-1 shadow-inner animate-fade-in">
                              <img src={formBolsa.foto_url} alt="Etiqueta capturada" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>

                        {/* Form Details */}
                        <form onSubmit={handleSaveBolsa} className="flex flex-col gap-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider" htmlFor="prod-code">Código da Etiqueta</label>
                            <input 
                              id="prod-code"
                              type="text" 
                              required 
                              value={formBolsa.codigo} 
                              onChange={e => setFormBolsa(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))} 
                              placeholder="Ex: BOLS-5602" 
                              className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider" htmlFor="prod-nome">Nome do Produto</label>
                            <input 
                              id="prod-nome"
                              type="text" 
                              required 
                              value={formBolsa.nome} 
                              onChange={e => setFormBolsa({ ...formBolsa, nome: e.target.value })} 
                              placeholder="Ex: Chanel Classic Double Flap" 
                              className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">MARCA</label>
                              <input 
                                type="text" 
                                value={formBolsa.marca} 
                                onChange={e => setFormBolsa({ ...formBolsa, marca: e.target.value })} 
                                placeholder="Ex: Chanel" 
                                className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">COR</label>
                              <input 
                                type="text" 
                                value={formBolsa.cor} 
                                onChange={e => setFormBolsa({ ...formBolsa, cor: e.target.value })} 
                                placeholder="Ex: Preta" 
                                className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">TAMANHO</label>
                              <input 
                                type="text" 
                                value={formBolsa.tamanho} 
                                onChange={e => setFormBolsa({ ...formBolsa, tamanho: e.target.value })} 
                                placeholder="Ex: M" 
                                className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">MATERIAL</label>
                              <input 
                                type="text" 
                                value={formBolsa.material} 
                                onChange={e => setFormBolsa({ ...formBolsa, material: e.target.value })} 
                                placeholder="Ex: Couro Caviar" 
                                className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Preço de Venda (R$)</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              required 
                              value={formBolsa.preco_venda} 
                              onChange={e => setFormBolsa({ ...formBolsa, preco_venda: e.target.value })} 
                              placeholder="0.00" 
                              className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Quantidade</label>
                              <input 
                                type="number" 
                                min="1" 
                                value={formBolsa.quantidade} 
                                onChange={e => setFormBolsa({ ...formBolsa, quantidade: e.target.value })} 
                                className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Estoque Mínimo</label>
                              <input 
                                type="number" 
                                min="1" 
                                value={formBolsa.quantidade_minima} 
                                onChange={e => setFormBolsa({ ...formBolsa, quantidade_minima: e.target.value })} 
                                className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 mt-2">
                            <button 
                              type="submit" 
                              className="w-full py-3.5 px-5 min-h-[48px] bg-gradient-to-r from-[#D12D6C] via-[#E23B7C] to-[#F44B8C] hover:from-[#B8255B] hover:to-[#D12D6C] text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-[0_6px_20px_rgba(209,45,108,0.25)] hover:shadow-[0_10px_28px_rgba(209,45,108,0.4)] border border-white/10 transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 cursor-pointer group antialiased"
                            >
                              <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">
                                {editingBolsa ? "save" : "add"}
                              </span>
                              {editingBolsa ? "Salvar Alterações" : "Adicionar ao Estoque"}
                            </button>

                            {editingBolsa && (
                              <button 
                                type="button" 
                                onClick={() => {
                                  setEditingBolsa(null);
                                  setFormBolsa({
                                    codigo: "", nome: "", marca: "", cor: "", tamanho: "", 
                                    material: "", foto_url: "", preco_custo: "", preco_venda: "", 
                                    preco_desconto: "", desconto_ativo: false, quantidade: 1, quantidade_minima: 2
                                  });
                                }}
                                className="w-full py-3.5 px-5 min-h-[48px] bg-white hover:bg-[#FFEBF2] text-[#D12D6C] rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 border border-[#EACAD6] hover:border-[#D12D6C]/30 shadow-[0_2px_8px_rgba(234,202,214,0.3)] hover:shadow-[0_4px_14px_rgba(234,202,214,0.5)] transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 cursor-pointer group antialiased"
                              >
                                <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">close</span>
                                Cancelar Edição
                              </button>
                            )}
                          </div>
                        </form>
                      </section>
                    </div>

                  {/* Right Column: Inventory List & Monitor */}
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <section className="bg-white rounded-[24px] border border-[#FCEEF3] shadow-sm p-6 flex flex-col gap-4">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FCEEF3] pb-3">
                        <div>
                          <h2 className="text-xl font-extrabold text-[#29141B]">Consulta de Inventário</h2>
                          <p className="text-xs text-[#29141B]/60">Monitore os produtos disponíveis e controle de promoções.</p>
                        </div>
                        
                        {/* Table vs Grid toggle */}
                        <div className="flex bg-[#FCFAF9] border border-[#FCEEF3] rounded-xl overflow-hidden shrink-0 self-start sm:self-auto shadow-inner">
                          <button 
                            type="button"
                            onClick={() => setViewMode("table")} 
                            className={`px-4 py-2 text-xs font-bold transition-all ${viewMode === "table" ? "bg-[#D12D6C] text-white shadow-sm" : "text-[#29141B]/60 hover:text-[#D12D6C]"}`}
                          >
                            Tabela
                          </button>
                          <button 
                            type="button"
                            onClick={() => setViewMode("grid")} 
                            className={`px-4 py-2 text-xs font-bold transition-all ${viewMode === "grid" ? "bg-[#D12D6C] text-white shadow-sm" : "text-[#29141B]/60 hover:text-[#D12D6C]"}`}
                          >
                            Fotos
                          </button>
                        </div>
                      </div>

                      {/* Filters */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#D12D6C] text-base">search</span>
                          <input 
                            type="text" 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            placeholder="Buscar produtos..." 
                            className="pl-9 h-10 w-full rounded-xl border border-[#FCEEF3] bg-white px-3 text-[#29141B] placeholder-[#29141B]/35 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                          />
                        </div>
                        <div>
                          <select 
                            value={filterStatus} 
                            onChange={e => setFilterStatus(e.target.value)}
                            className="h-10 w-full rounded-xl border border-[#FCEEF3] bg-white px-3 text-[#29141B] focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none text-sm shadow-sm"
                          >
                            <option value="all">Todos os Status</option>
                            <option value="disponivel">Disponível em Estoque</option>
                            <option value="esgotado">Esgotado</option>
                            <option value="baixo_estoque">Abaixo do Mínimo (Alerta)</option>
                          </select>
                        </div>
                        <div>
                          <select 
                            value={filterDesconto} 
                            onChange={e => setFilterDesconto(e.target.value)}
                            className="h-10 w-full rounded-xl border border-[#FCEEF3] bg-white px-3 text-[#29141B] focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none text-sm shadow-sm"
                          >
                            <option value="all">Todos os Produtos</option>
                            <option value="ativo">Em Promoção</option>
                            <option value="inativo">Preço Cheio</option>
                          </select>
                        </div>
                      </div>
                      
                      {/* Quick Product Photo Preview */}
                      <AnimatePresence>
                        {searchQuery.trim() !== "" && filteredBolsas.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, y: -10 }}
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[#FCFAF9] border border-[#FCEEF3] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 shadow-sm overflow-hidden mb-2"
                          >
                            <div 
                              className="w-28 h-28 bg-white rounded-xl border border-[#FCEEF3] overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer group shadow-sm"
                              onClick={() => setSelectedBolsaForView(filteredBolsas[0])}
                              title="Visualizar Ficha Técnica"
                            >
                              {filteredBolsas[0].foto_url ? (
                                <img 
                                  src={filteredBolsas[0].foto_url} 
                                  alt={filteredBolsas[0].nome} 
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" 
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-[#29141B]/60 gap-1 text-[10px] uppercase font-bold tracking-wider">
                                  <span className="material-symbols-outlined text-2xl text-[#D12D6C]">shopping_bag</span>
                                  <span>Sem Foto</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col justify-center text-center sm:text-left w-full">
                              <span className="text-[9px] font-bold text-[#D12D6C] tracking-widest uppercase">
                                {filteredBolsas[0].marca || "Sem Marca"}
                              </span>
                              <h3 
                                onClick={() => setSelectedBolsaForView(filteredBolsas[0])}
                                className="font-extrabold text-base text-[#29141B] leading-tight mt-0.5 cursor-pointer hover:text-[#D12D6C] transition-colors"
                              >
                                {filteredBolsas[0].nome}
                              </h3>
                              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2 font-mono text-[11px]">
                                <span className="bg-[#FFEBF2] text-[#D12D6C] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider text-[10px] shadow-sm">
                                  {filteredBolsas[0].codigo}
                                </span>
                                <span className="text-[#29141B]/60">
                                  • Cor: {filteredBolsas[0].cor || "-"}
                                </span>
                                <span className="text-[#29141B]/60">
                                  • Tam: {filteredBolsas[0].tamanho || "-"}
                                </span>
                              </div>
                              
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-[#FCEEF3] pt-2 w-full">
                                <div className="flex flex-wrap gap-6">
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50 block">Preço de Venda</span>
                                    {filteredBolsas[0].desconto_ativo && filteredBolsas[0].preco_desconto ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="line-through text-[11px] text-[#29141B]/40">R$ {Number(filteredBolsas[0].preco_venda).toFixed(2)}</span>
                                        <span className="font-extrabold text-[#D12D6C] text-sm">R$ {Number(filteredBolsas[0].preco_desconto).toFixed(2)}</span>
                                      </div>
                                    ) : (
                                      <span className="font-extrabold text-[#29141B] text-sm">R$ {Number(filteredBolsas[0].preco_venda).toFixed(2)}</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50 block">Estoque</span>
                                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${filteredBolsas[0].quantidade <= Math.max(Number(filteredBolsas[0].quantidade_minima || 0), 2) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                                      {filteredBolsas[0].quantidade} un
                                    </span>
                                  </div>
                                </div>
                                
                                <button 
                                  onClick={() => setSelectedBolsaForView(filteredBolsas[0])}
                                  className="btn text-[11px] font-bold text-[#D12D6C] border border-[#FCEEF3] hover:border-[#D12D6C] hover:bg-[#FFEBF2] px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition-all active:scale-95 bg-white"
                                >
                                  <span className="material-symbols-outlined text-xs">visibility</span>
                                  Ficha Técnica
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Table rendering */}
                      {viewMode === "table" && (
                        <>
                          {/* Visualização Desktop (Tabela) */}
                          <div className="hidden md:block overflow-x-auto border border-[#FCEEF3] rounded-xl">
                            <table className="w-full text-sm border-collapse text-left bg-white">
                              <thead>
                                <tr className="bg-[#FCFAF9] border-b border-[#FCEEF3] text-[10px] font-bold uppercase tracking-widest text-[#29141B]/70">
                                  <th className="p-3 min-w-[250px] w-[35%]">Produto</th>
                                  <th className="p-3">Código</th>
                                  <th className="p-3">Estoque</th>
                                  <th className="p-3">Preço</th>
                                  {profile?.role === "admin" && <th className="p-3">Descontos / Ações</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredBolsas.map(b => (
                                  <tr key={b.id} className="border-b border-[#FCEEF3] hover:bg-[#FCFAF9]/50 transition-colors">
                                    <td className="p-3 min-w-[250px]">
                                      <div 
                                        className="flex items-center gap-3 cursor-pointer group"
                                        onClick={() => setSelectedBolsaForView(b)}
                                        title="Visualizar Detalhes do Produto"
                                      >
                                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-[#FCEEF3] flex items-center justify-center flex-shrink-0 group-hover:border-[#D12D6C] transition-colors shadow-sm">
                                          {b.foto_url ? (
                                            <img src={b.foto_url} alt={b.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                          ) : (
                                            <span className="material-symbols-outlined text-sm text-[#29141B]/60">shopping_bag</span>
                                          )}
                                        </div>
                                        <div>
                                          <span className="block text-sm font-extrabold text-[#29141B] group-hover:text-[#D12D6C] transition-colors">{b.nome}</span>
                                          <span className="block text-[10px] text-[#29141B]/75 font-semibold mt-0.5">
                                            {b.marca || "Sem Marca"} {b.cor ? `| Cor: ${b.cor}` : ""} {b.tamanho ? `| Tam: ${b.tamanho}` : ""}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <span className="bg-[#FFEBF2] text-[#D12D6C] px-2 py-0.5 rounded-lg font-mono text-xs uppercase font-bold tracking-wider shadow-sm">
                                        {b.codigo}
                                      </span>
                                    </td>
                                    <td className="p-3 text-sm">
                                      <span className={b.quantidade <= Math.max(Number(b.quantidade_minima || 0), 2) ? "font-bold text-rose-600 flex items-center gap-0.5" : "text-[#29141B]"}>
                                        {b.quantidade} un
                                        {b.quantidade <= Math.max(Number(b.quantidade_minima || 0), 2) && (
                                          <span className="material-symbols-outlined text-xs text-rose-600">warning</span>
                                        )}
                                      </span>
                                    </td>
                                    <td className="p-3 font-semibold">
                                      {b.desconto_ativo && b.preco_desconto ? (
                                        <div className="flex flex-col">
                                          <span className="line-through text-xs text-[#29141B]/40">R$ {Number(b.preco_venda).toFixed(2)}</span>
                                          <span className="font-extrabold text-[#D12D6C] text-sm">R$ {Number(b.preco_desconto).toFixed(2)}</span>
                                        </div>
                                      ) : (
                                        <span className="text-[#29141B]">R$ {Number(b.preco_venda).toFixed(2)}</span>
                                      )}
                                    </td>
                                    {profile?.role === "admin" && (
                                      <td className="p-3">
                                        <div className="flex items-center gap-4">
                                          {/* Toggle Promo input */}
                                          <div className="flex items-center gap-1.5">
                                            <input 
                                              type="checkbox" 
                                              id={`promo-${b.id}`}
                                              checked={b.desconto_ativo} 
                                              onChange={(e) => {
                                                const targetPrice = b.preco_desconto || (Number(b.preco_venda) * 0.9);
                                                handleToggleDesconto(b.id, e.target.checked, targetPrice);
                                              }}
                                              className="w-4 h-4 cursor-pointer accent-[#D12D6C] border-[#FCEEF3] rounded"
                                            />
                                            <label htmlFor={`promo-${b.id}`} className="text-xs text-[#29141B]/60 cursor-pointer">Promo</label>
                                          </div>

                                          {/* Input to change promo value */}
                                          {b.desconto_ativo && (
                                            <input 
                                              type="number"
                                              step="0.01"
                                              placeholder="Promo R$"
                                              value={b.tempPromo !== undefined ? b.tempPromo : (b.preco_desconto || "")}
                                              onChange={(e) => handlePromoChange(b.id, e.target.value)}
                                              onBlur={() => {
                                                const newPromoVal = b.tempPromo !== undefined ? b.tempPromo : b.preco_desconto;
                                                if (newPromoVal) handleToggleDesconto(b.id, true, newPromoVal);
                                              }}
                                              className="w-20 h-7 border border-[#FCEEF3] rounded px-1.5 text-xs bg-white focus:border-[#D12D6C] focus:ring-[#D12D6C] focus:outline-none shadow-sm"
                                            />
                                          )}

                                          {/* Edit Action */}
                                          <button 
                                            onClick={() => {
                                              setEditingBolsa(b);
                                              setFormBolsa({
                                                codigo: b.codigo || "",
                                                nome: b.nome || "",
                                                marca: b.marca || "",
                                                cor: b.cor || "",
                                                tamanho: b.tamanho || "",
                                                material: b.material || "",
                                                foto_url: b.foto_url || "",
                                                preco_custo: b.preco_custo || "",
                                                preco_venda: b.preco_venda || "",
                                                preco_desconto: b.preco_desconto || "",
                                                desconto_ativo: b.desconto_ativo || false,
                                                quantidade: b.quantidade || 0,
                                                quantidade_minima: b.quantidade_minima || 2
                                              });
                                              document.getElementById("prod-code")?.focus();
                                            }}
                                            className="p-1.5 rounded-lg bg-[#FFEBF2] hover:bg-[#D12D6C] border border-[#FAD6E5]/70 text-[#D12D6C] hover:text-white transition-all flex items-center justify-center shadow-xs"
                                            title="Editar Produto"
                                          >
                                            <span className="material-symbols-outlined text-base">edit</span>
                                          </button>

                                          {/* Delete Action */}
                                          <button 
                                            onClick={async () => {
                                              if (confirm(`Deseja realmente excluir o produto ${b.nome}?`)) {
                                                const { error } = await supabase.from("bolsas").delete().eq("id", b.id);
                                                if (error) alert("Erro ao excluir: " + error.message);
                                                else { alert("Produto excluído com sucesso!"); loadAllData(); }
                                              }
                                            }}
                                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 border border-rose-200 text-rose-600 hover:text-white transition-all flex items-center justify-center shadow-xs"
                                            title="Excluir"
                                          >
                                            <span className="material-symbols-outlined text-base">delete</span>
                                          </button>
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                                {filteredBolsas.length === 0 && (
                                  <tr>
                                    <td colSpan={profile?.role === "admin" ? 5 : 4} className="text-center text-[#29141B]/60 py-12 font-body-sm bg-white">
                                      Nenhum produto encontrado correspondente aos filtros.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Visualização Mobile (Cards Premium) */}
                          <div className="block md:hidden flex flex-col gap-3">
                            {filteredBolsas.map(b => {
                              const isLow = b.quantidade <= Math.max(Number(b.quantidade_minima || 0), 2);
                              return (
                                <div 
                                  key={b.id} 
                                  className="bg-white border border-[#FCEEF3] rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm hover:bg-[#FFEBF2]/10 transition-all cursor-pointer"
                                  onClick={() => setSelectedBolsaForView(b)}
                                  title="Visualizar Detalhes"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-[#FCFAF9] rounded-xl flex items-center justify-center shrink-0 border border-[#FCEEF3] overflow-hidden">
                                        {b.foto_url ? (
                                          <img src={b.foto_url} alt={b.nome} className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="material-symbols-outlined text-xl text-[#29141B]/60">shopping_bag</span>
                                        )}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="font-extrabold text-sm text-[#29141B] leading-tight">{b.nome}</span>
                                        <span className="text-[10px] text-[#29141B]/75 font-semibold mt-0.5">
                                          {b.marca || "Sem Marca"} {b.cor ? `• Cor: ${b.cor}` : ""} {b.tamanho ? `• Tam: ${b.tamanho}` : ""}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="bg-[#FFEBF2] text-[#D12D6C] px-2 py-0.5 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider shadow-xs shrink-0 self-start">
                                      {b.codigo}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 border-t border-[#FCEEF3] pt-3 text-xs">
                                    <div>
                                      <span className="block text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50">Estoque</span>
                                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 shadow-sm ${isLow ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                        {b.quantidade} un
                                        {isLow && <span className="material-symbols-outlined text-[10px] text-rose-600">warning</span>}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="block text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50">Valor</span>
                                      {b.desconto_ativo && b.preco_desconto ? (
                                        <div className="flex flex-col mt-0.5">
                                          <span className="line-through text-[10px] text-[#29141B]/40 leading-none">R$ {Number(b.preco_venda).toFixed(2)}</span>
                                          <span className="font-extrabold text-[#D12D6C] text-xs mt-0.5 leading-none">R$ {Number(b.preco_desconto).toFixed(2)}</span>
                                        </div>
                                      ) : (
                                        <span className="font-extrabold text-[#29141B] text-xs block mt-1">R$ {Number(b.preco_venda).toFixed(2)}</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Admin operations */}
                                  {profile?.role === "admin" && (
                                    <div className="border-t border-[#FCEEF3] pt-3.5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <input 
                                            type="checkbox" 
                                            id={`promo-mob-${b.id}`}
                                            checked={b.desconto_ativo} 
                                            onChange={(e) => {
                                              const targetPrice = b.preco_desconto || (Number(b.preco_venda) * 0.9);
                                              handleToggleDesconto(b.id, e.target.checked, targetPrice);
                                            }}
                                            className="w-4 h-4 cursor-pointer accent-[#D12D6C] border-[#FCEEF3] rounded"
                                          />
                                          <label htmlFor={`promo-mob-${b.id}`} className="text-xs text-[#29141B]/70 font-semibold cursor-pointer">Promoção</label>
                                        </div>

                                        {b.desconto_ativo && (
                                          <input 
                                            type="number"
                                            step="0.01"
                                            placeholder="Promo R$"
                                            value={b.tempPromo !== undefined ? b.tempPromo : (b.preco_desconto || "")}
                                            onChange={(e) => handlePromoChange(b.id, e.target.value)}
                                            onBlur={() => {
                                              const newPromoVal = b.tempPromo !== undefined ? b.tempPromo : b.preco_desconto;
                                              if (newPromoVal) handleToggleDesconto(b.id, true, newPromoVal);
                                            }}
                                            className="w-24 h-8 border border-[#EACAD6] rounded-xl px-2 text-xs bg-white focus:border-[#D12D6C] focus:ring-[#D12D6C] focus:outline-none shadow-sm"
                                          />
                                        )}
                                      </div>

                                      <div className="flex items-center justify-end gap-2 border-t border-[#FCEEF3]/50 pt-2.5">
                                        {/* Edit button */}
                                        <button 
                                          onClick={() => {
                                            setEditingBolsa(b);
                                            setFormBolsa({
                                              codigo: b.codigo || "",
                                              nome: b.nome || "",
                                              marca: b.marca || "",
                                              cor: b.cor || "",
                                              tamanho: b.tamanho || "",
                                              material: b.material || "",
                                              foto_url: b.foto_url || "",
                                              preco_custo: b.preco_custo || "",
                                              preco_venda: b.preco_venda || "",
                                              preco_desconto: b.preco_desconto || "",
                                              desconto_ativo: b.desconto_ativo || false,
                                              quantidade: b.quantidade || 0,
                                              quantidade_minima: b.quantidade_minima || 2
                                            });
                                            document.getElementById("prod-code")?.focus();
                                          }}
                                          className="bg-[#FFEBF2] hover:bg-[#D12D6C] border border-[#FAD6E5] text-[#D12D6C] hover:text-white py-1.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                                        >
                                          <span className="material-symbols-outlined text-xs">edit</span>
                                          Editar
                                        </button>

                                        {/* Delete button */}
                                        <button 
                                          onClick={async () => {
                                            if (confirm(`Deseja realmente excluir o produto ${b.nome}?`)) {
                                              const { error } = await supabase.from("bolsas").delete().eq("id", b.id);
                                              if (error) alert("Erro ao excluir: " + error.message);
                                              else { alert("Produto excluído com sucesso!"); loadAllData(); }
                                            }
                                          }}
                                          className="bg-rose-50 hover:bg-rose-600 border border-rose-200 text-rose-600 hover:text-white py-1.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                                        >
                                          <span className="material-symbols-outlined text-xs">delete</span>
                                          Excluir
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {filteredBolsas.length === 0 && (
                              <div className="text-center text-[#29141B]/60 py-12 font-medium bg-white border border-[#FCEEF3] rounded-2xl shadow-sm">
                                Nenhum produto encontrado correspondente aos filtros.
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Grid / Photo rendering */}
                      {viewMode === "grid" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {filteredBolsas.map(b => (
                            <div 
                              key={b.id} 
                              className="bg-white border border-[#FCEEF3] rounded-3xl p-4 flex flex-col gap-3 relative shadow-sm hover:shadow-md transition-shadow"
                            >
                              {b.desconto_ativo && b.preco_desconto && (
                                <div className="absolute top-2 right-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 z-10 shadow-sm">
                                  <span className="material-symbols-outlined text-xs">local_offer</span>
                                  PROMO
                                </div>
                              )}

                              {/* Photo Canvas */}
                              <div 
                                className="h-36 w-full bg-[#FCFAF9] rounded-xl overflow-hidden border border-[#FCEEF3] flex items-center justify-center relative cursor-pointer group shadow-sm"
                                onClick={() => setSelectedBolsaForView(b)}
                              >
                                {b.foto_url ? (
                                  <img src={b.foto_url} alt={b.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-[#29141B]/60 gap-1">
                                    <span className="material-symbols-outlined text-3xl text-[#D12D6C]">shopping_bag</span>
                                    <span className="text-[10px]">Sem Foto</span>
                                  </div>
                                )}

                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-[#29141B]/15 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200 rounded-lg">
                                  <div className="bg-white px-3 py-1.5 rounded-full border border-[#FCEEF3] text-[11px] font-bold text-[#29141B] flex items-center gap-1 shadow-md hover:text-[#D12D6C] transition-colors">
                                    <span className="material-symbols-outlined text-sm text-[#D12D6C]">visibility</span>
                                    Visualizar
                                  </div>
                                </div>

                                <div className="absolute bottom-1.5 left-1.5 bg-[#29141B]/80 text-[10px] px-2 py-0.5 rounded border border-white/10 text-white font-mono uppercase font-bold tracking-wider z-10">
                                  {b.codigo}
                                </div>
                              </div>

                              {/* Data Text */}
                              <div className="flex flex-col gap-0.5 flex-1">
                                <span className="text-[10px] font-bold text-[#D12D6C] tracking-widest uppercase">{b.marca || "Sem Marca"}</span>
                                <h3 
                                  onClick={() => setSelectedBolsaForView(b)}
                                  className="font-extrabold text-sm text-[#29141B] leading-snug cursor-pointer hover:text-[#D12D6C] transition-colors"
                                >
                                  {b.nome}
                                </h3>
                                <p className="text-[10px] text-[#29141B]/60">Cor: {b.cor || "-"} | Tam: {b.tamanho || "-"} | Mat: {b.material || "-"}</p>

                                <div className="mt-3 flex items-end justify-between border-t border-[#FCEEF3] pt-2">
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50 block">Valor</span>
                                    {b.desconto_ativo && b.preco_desconto ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="line-through text-xs text-[#29141B]/40">R$ {Number(b.preco_venda).toFixed(2)}</span>
                                        <span className="font-extrabold text-[#D12D6C] text-sm">R$ {Number(b.preco_desconto).toFixed(2)}</span>
                                      </div>
                                    ) : (
                                      <span className="font-extrabold text-[#29141B] text-sm">R$ {Number(b.preco_venda).toFixed(2)}</span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50 block">Estoque</span>
                                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${b.quantidade <= Math.max(Number(b.quantidade_minima || 0), 2) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                                      {b.quantidade} un
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Admin operations */}
                              {profile?.role === "admin" && (
                                <div className="border-t border-[#FCEEF3] pt-2 flex items-center justify-between gap-2 mt-auto">
                                  <div className="flex items-center gap-1.5">
                                    <input 
                                      type="checkbox" 
                                      id={`promo-grid-${b.id}`}
                                      checked={b.desconto_ativo} 
                                      onChange={(e) => {
                                        const targetPrice = b.preco_desconto || (Number(b.preco_venda) * 0.9);
                                        handleToggleDesconto(b.id, e.target.checked, targetPrice);
                                      }}
                                      className="w-4 h-4 cursor-pointer accent-[#D12D6C] border-[#FCEEF3] rounded"
                                    />
                                    <label htmlFor={`promo-grid-${b.id}`} className="text-xs text-[#29141B]/60 cursor-pointer">Promoção</label>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {/* Edit Action */}
                                    <button 
                                      onClick={() => {
                                        setEditingBolsa(b);
                                        setFormBolsa({
                                          codigo: b.codigo || "",
                                          nome: b.nome || "",
                                          marca: b.marca || "",
                                          cor: b.cor || "",
                                          tamanho: b.tamanho || "",
                                          material: b.material || "",
                                          foto_url: b.foto_url || "",
                                          preco_custo: b.preco_custo || "",
                                          preco_venda: b.preco_venda || "",
                                          preco_desconto: b.preco_desconto || "",
                                          desconto_ativo: b.desconto_ativo || false,
                                          quantidade: b.quantidade || 0,
                                          quantidade_minima: b.quantidade_minima || 2
                                        });
                                        document.getElementById("prod-code")?.focus();
                                      }}
                                      className="p-1 rounded text-[#D12D6C] hover:bg-[#FFEBF2] transition-colors"
                                      title="Editar Produto"
                                    >
                                      <span className="material-symbols-outlined text-base">edit</span>
                                    </button>

                                    {/* Delete Action */}
                                    <button 
                                      onClick={async () => {
                                        if (confirm(`Deseja realmente excluir o produto ${b.nome}?`)) {
                                          const { error } = await supabase.from("bolsas").delete().eq("id", b.id);
                                          if (error) alert("Erro ao excluir: " + error.message);
                                          else { alert("Produto excluído com sucesso!"); loadAllData(); }
                                        }
                                      }}
                                      className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="Excluir"
                                    >
                                      <span className="material-symbols-outlined text-base">delete</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {filteredBolsas.length === 0 && (
                            <div className="col-span-full border border-[#FCEEF3] rounded-2xl bg-white p-12 text-center text-[#29141B]/60 shadow-sm">
                              Nenhum produto encontrado correspondente aos filtros.
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* SAÍDAS / VENDAS PAGE                                     */}
              {/* ======================================================== */}
              {activeTab === "saidas" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Left Column: Form & Quick Client */}
                  <div className="lg:col-span-1 flex flex-col gap-6">
                    
                    {/* Register Venda Form */}
                    <section className="bg-white rounded-[24px] border border-[#FCEEF3] shadow-sm p-6 flex flex-col gap-6">
                      <div className="flex items-center gap-3 border-b border-[#FCEEF3] pb-3">
                        <span className="material-symbols-outlined text-[#D12D6C] text-2xl">shopping_cart</span>
                        <h2 className="text-xl font-extrabold text-[#29141B]">Registrar Venda</h2>
                      </div>
                      
                      <form onSubmit={handleSaveVenda} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Adicionar por Código</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#29141B]/40">tag</span>
                              <input 
                                type="text"
                                value={buscaCodigoVenda}
                                onChange={e => setBuscaCodigoVenda(e.target.value)}
                                onKeyDown={handleKeyDownCodigo}
                                placeholder="Digite o código..."
                                className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white pl-9 pr-3 text-[#29141B] placeholder-[#29141B]/35 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAdicionarPorCodigo}
                              className="h-11 px-4 rounded-xl bg-[#D12D6C] hover:bg-[#B8255B] text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm">add</span>
                              Adicionar
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Ou Selecionar na Lista</label>
                          <select 
                            value="" 
                            onChange={e => {
                              addToCart(e.target.value);
                            }}
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm cursor-pointer"
                          >
                            <option value="" disabled hidden>Selecionar produto...</option>
                            {bolsas.filter(b => b.quantidade > 0).map(b => (
                              <option key={b.id} value={b.id}>
                                {b.nome} ({b.codigo}) — R$ {b.desconto_ativo && b.preco_desconto ? Number(b.preco_desconto).toFixed(2) : Number(b.preco_venda).toFixed(2)} • Est: {b.quantidade}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Shopping Cart List */}
                        {cart.length === 0 ? (
                          <div className="border-2 border-dashed border-[#FCEEF3] rounded-xl p-4 text-center text-[#29141B]/40 text-xs font-medium bg-[#FCFAF9]">
                            Nenhum produto adicionado
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                              {cart.map(item => {
                                const itemPrice = item.desconto_ativo && item.preco_desconto 
                                  ? Number(item.preco_desconto) 
                                  : Number(item.preco_venda);
                                const totalItemPrice = itemPrice * item.qty;
                                return (
                                  <div key={item.id} className="bg-[#FCFAF9] border border-[#FCEEF3] rounded-xl p-3 shadow-sm transition-all hover:border-[#D12D6C]/30">
                                    {/* Row 1: Photo + Name + Remove */}
                                    <div className="flex items-center gap-2.5 mb-2">
                                      {item.foto_url ? (
                                        <img src={item.foto_url} alt={item.nome} className="w-8 h-8 rounded-lg object-cover border border-[#FCEEF3] shrink-0" />
                                      ) : (
                                        <div className="w-8 h-8 rounded-lg bg-[#FFEBF2] flex items-center justify-center shrink-0 text-[#D12D6C]">
                                          <span className="material-symbols-outlined text-sm">shopping_bag</span>
                                        </div>
                                      )}
                                      <span className="text-xs font-bold text-[#29141B] truncate flex-1">{item.nome}</span>
                                      {item.desconto_ativo && (
                                        <span className="text-[7px] bg-[#FFEBF2] text-[#D12D6C] font-extrabold tracking-widest uppercase px-1.5 py-0.5 rounded shrink-0">PROMO</span>
                                      )}
                                      <button 
                                        type="button" 
                                        onClick={() => removeFromCart(item.id)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shrink-0 shadow-xs"
                                        title="Remover"
                                      >
                                        <span className="material-symbols-outlined text-base">close</span>
                                      </button>
                                    </div>
                                    {/* Row 2: Price + Quantity Controls */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-extrabold text-[#29141B]">R$ {totalItemPrice.toFixed(2)}</span>
                                        {item.qty > 1 && (
                                          <span className="text-[9px] text-[#29141B]/45 font-semibold">R$ {itemPrice.toFixed(2)} / un</span>
                                        )}
                                      </div>
                                      <div className="flex items-center bg-white border border-[#EACAD6] rounded-lg overflow-hidden h-8">
                                        <button 
                                          type="button" 
                                          onClick={() => updateCartQty(item.id, -1)}
                                          className="w-8 h-full flex items-center justify-center text-[#D12D6C] hover:bg-[#FFEBF2] active:scale-90 transition-all font-bold text-sm"
                                        >
                                          −
                                        </button>
                                        <span className="px-3 text-sm font-bold text-[#29141B] select-none text-center min-w-[24px]">{item.qty}</span>
                                        <button 
                                          type="button" 
                                          onClick={() => updateCartQty(item.id, 1)}
                                          className="w-8 h-full flex items-center justify-center text-[#D12D6C] hover:bg-[#FFEBF2] active:scale-90 transition-all font-bold text-sm"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Financial Summary */}
                            {(() => {
                              const subtotal = cart.reduce((acc, item) => {
                                const price = item.desconto_ativo && item.preco_desconto ? item.preco_desconto : item.preco_venda;
                                return acc + (price * item.qty);
                              }, 0);
                              const descVal = Number(descontoVenda) || 0;
                              const total = Math.max(0, subtotal - descVal);
                              return (
                                <div className="flex flex-col gap-2 bg-[#FFFDF8] border border-[#F6E1B6] rounded-xl p-3">
                                  {descVal > 0 && (
                                    <div className="flex justify-between items-center text-xs font-semibold text-[#29141B]/70 border-b border-[#FCEEF3] pb-1.5 mb-1.5">
                                      <span>Subtotal:</span>
                                      <span>R$ {subtotal.toFixed(2)}</span>
                                    </div>
                                  )}
                                  {descVal > 0 && (
                                    <div className="flex justify-between items-center text-xs font-semibold text-rose-600 border-b border-[#FCEEF3] pb-1.5 mb-1.5">
                                      <span>Desconto Manual:</span>
                                      <span>- R$ {descVal.toFixed(2)}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase text-[#C9A84C] tracking-widest">{descVal > 0 ? "TOTAL COM DESCONTO" : "TOTAL"}</span>
                                      <span className="text-lg font-black text-[#29141B]">R$ {total.toFixed(2)}</span>
                                    </div>
                                    <span className="text-[9px] bg-[#C9A84C]/10 text-[#a3832d] font-bold px-2 py-0.5 rounded-full">
                                      {cart.reduce((acc, item) => acc + item.qty, 0)} itens
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Cliente</label>
                          <select 
                            required 
                            value={formVenda.cliente_id} 
                            onChange={e => setFormVenda({ ...formVenda, cliente_id: e.target.value })}
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm cursor-pointer"
                          >
                            <option value="" disabled hidden>Selecione o cliente...</option>
                            {clientes.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.nome} {c.cpf ? `(CPF: ${c.cpf})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Vendedor</label>
                          <select 
                            required 
                            disabled={profile?.role !== "admin"}
                            value={formVenda.funcionario_id || profile?.id || ""} 
                            onChange={e => setFormVenda({ ...formVenda, funcionario_id: e.target.value })}
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white disabled:bg-[#FCFAF9] disabled:cursor-not-allowed px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm cursor-pointer"
                          >
                            {profile?.role !== "admin" ? (
                              <option value={profile?.id || ""}>{profile?.nome || "Carregando..."}</option>
                            ) : (
                              <>
                                <option value="" disabled hidden>Selecione o vendedor...</option>
                                {funcionarios.map(f => (
                                  <option key={f.id} value={f.id}>{f.nome}</option>
                                ))}
                              </>
                            )}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Adicionar Desconto</label>
                          <input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            value={descontoVenda} 
                            onChange={e => setDescontoVenda(e.target.value)} 
                            placeholder="0.00" 
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/35 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Forma de Pagamento</label>
                          <select 
                            required 
                            value={formVenda.forma_pagamento} 
                            onChange={e => setFormVenda({ ...formVenda, forma_pagamento: e.target.value })}
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm cursor-pointer"
                          >
                            <option value="dinheiro">Dinheiro</option>
                            <option value="debito">Débito</option>
                            <option value="credito">Crédito</option>
                            <option value="pix">Pix</option>
                            <option value="boleto">Boleto</option>
                            <option value="credito_parcelado">Crédito Parcelado</option>
                            <option value="credito_a_vista">Crédito à Vista</option>
                            <option value="voucher">Voucher</option>
                            <option value="pix_online">Pix Online (Site)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Observações / Notas</label>
                          <textarea 
                            value={formVenda.observacao} 
                            onChange={e => setFormVenda({ ...formVenda, observacao: e.target.value })}
                            placeholder="Notas de pagamento, canal de venda..."
                            rows={3}
                            className="w-full rounded-xl border border-[#EACAD6] bg-white p-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                          />
                        </div>

                        <button 
                          type="submit" 
                          className="mt-3 w-full py-3.5 px-5 min-h-[48px] bg-gradient-to-r from-[#D12D6C] via-[#E23B7C] to-[#F44B8C] hover:from-[#B8255B] hover:to-[#D12D6C] text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-[0_6px_20px_rgba(209,45,108,0.25)] hover:shadow-[0_10px_28px_rgba(209,45,108,0.4)] border border-white/10 transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 cursor-pointer group antialiased"
                        >
                          <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">check_circle</span>
                          Confirmar Venda
                        </button>
                      </form>
                    </section>

                    {/* Quick Add Client */}
                    <section className="bg-white rounded-[24px] border border-[#FCEEF3] shadow-sm p-6 flex flex-col gap-4">
                      <h4 className="font-extrabold text-[#29141B] border-b border-[#FCEEF3] pb-2 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#D12D6C] text-base">person_add</span>
                        Cadastrar Cliente Rápido
                      </h4>
                      <form onSubmit={handleSaveCliente} className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/60 uppercase tracking-wider">Nome Completo</label>
                          <input 
                            type="text" 
                            required 
                            value={formCliente.nome} 
                            onChange={e => setFormCliente({ ...formCliente, nome: e.target.value })} 
                            placeholder="Nome" 
                            className="h-9 w-full rounded-xl border border-[#FCEEF3] bg-white px-3 text-[#29141B] text-xs focus:ring-1 focus:ring-[#D12D6C] focus:border-[#D12D6C] outline-none shadow-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/60 uppercase tracking-wider">TELEFONE</label>
                          <input 
                            type="text" 
                            value={formCliente.telefone} 
                            onChange={e => setFormCliente({ ...formCliente, telefone: e.target.value })} 
                            placeholder="(XX) 99999-9999" 
                            className="h-9 w-full rounded-xl border border-[#FCEEF3] bg-white px-3 text-[#29141B] text-xs focus:ring-1 focus:ring-[#D12D6C] focus:border-[#D12D6C] outline-none shadow-sm"
                          />
                        </div>
                        <button 
                          type="submit" 
                          className="mt-2 w-full py-2.5 px-4 bg-white hover:bg-[#FFEBF2] text-[#D12D6C] rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-[#EACAD6] hover:border-[#D12D6C]/30 shadow-[0_2px_8px_rgba(234,202,214,0.2)] hover:shadow-[0_4px_12px_rgba(234,202,214,0.4)] transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0 cursor-pointer group antialiased"
                        >
                          <span className="material-symbols-outlined text-[14px] group-hover:scale-110 transition-transform">person_add</span>
                          Salvar Cliente
                        </button>
                      </form>
                    </section>

                  </div>

                  {/* Right Column: History of sales */}
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <section className="bg-white rounded-[24px] border border-[#FCEEF3] shadow-sm p-6 flex flex-col gap-4">
                      <div>
                        <h2 className="text-xl font-extrabold text-[#29141B]">Histórico de Saídas</h2>
                      </div>

                      {/* Visualização em Tabela (Desktop & Tablet) */}
                      <div className="hidden md:block overflow-x-auto border border-[#FCEEF3] rounded-2xl shadow-sm">
                        <table className="w-full text-sm border-collapse text-left bg-white">
                          <thead>
                            <tr className="bg-[#FCFAF9] border-b border-[#FCEEF3] text-[10px] font-bold uppercase tracking-widest text-[#29141B]/60">
                              <th className="p-3">Produto</th>
                              <th className="p-3">Cliente</th>
                              <th className="p-3">Vendedor</th>
                              <th className="p-3">Valor Pago</th>
                              <th className="p-3">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vendas.map(v => (
                              <tr key={v.id} className="border-b border-[#FCEEF3] hover:bg-[#FFEBF2]/40 transition-colors">
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div>
                                      <span className="block font-bold text-[#29141B]">{v.bolsas?.nome}</span>
                                      <span className="block text-[10px] text-[#29141B]/60">Cód: {v.bolsas?.codigo || "N/A"}</span>
                                    </div>
                                    {v.observacao && v.observacao.includes("[Trocada/Devolvida") && (
                                      <span 
                                        className="text-[8px] bg-rose-50 border border-rose-200 text-rose-600 font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 cursor-pointer hover:bg-rose-100 hover:border-rose-300 transition-all shadow-sm active:scale-95 flex items-center gap-0.5" 
                                        title="Clique para rastrear esta troca no histórico"
                                        onClick={() => handleRastrearTroca(v.bolsa_id, v.cliente_id)}
                                      >
                                        <span className="material-symbols-outlined text-[10px]">sync_alt</span>
                                        Devolvida
                                      </span>
                                    )}
                                    {v.forma_pagamento === "troca" && (
                                      <span className="text-[8px] bg-sky-50 border border-sky-200 text-sky-600 font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0" title="Este produto saiu como parte de uma troca">
                                        Troca
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className="text-[#29141B] font-medium">{v.clientes?.nome || "Consumidor Geral"}</span>
                                </td>
                                <td className="p-3 text-xs text-[#29141B]">
                                  {profile?.role === "admin" ? (
                                    <select
                                      value={v.funcionario_id || ""}
                                      onChange={async (e) => {
                                        const newFid = e.target.value;
                                        try {
                                          const { error } = await supabase
                                            .from("vendas")
                                            .update({ funcionario_id: newFid || null })
                                            .eq("id", v.id);
                                          if (error) throw error;
                                          loadAllData();
                                        } catch (err) {
                                          alert("Erro ao atualizar vendedor: " + err.message);
                                        }
                                      }}
                                      className="bg-white hover:bg-[#FCFAF9] text-[#29141B] border border-[#EACAD6] rounded-xl px-2 py-1 text-xs focus:ring-1 focus:ring-[#D12D6C] focus:border-[#D12D6C] outline-none cursor-pointer max-w-[150px] shadow-sm transition-all"
                                    >
                                      <option value="">Sem vendedor</option>
                                      {funcionarios.map(f => (
                                        <option key={f.id} value={f.id}>{f.nome}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="font-semibold text-[#29141B]/80 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[14px] text-[#29141B]/60">person</span>
                                      {funcionarios.find(f => f.id === v.funcionario_id)?.nome || "Sem vendedor"}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 w-fit text-xs">
                                      R$ {Number(v.preco_vendido).toFixed(2)}
                                    </span>
                                    {v.tinha_desconto && (
                                      <span className="text-[8px] text-[#D12D6C] bg-[#D12D6C]/10 border border-[#D12D6C]/20 uppercase font-bold tracking-widest px-1.5 py-0.5 rounded w-max mt-0.5">Promoção</span>
                                    )}
                                    {!v.tinha_desconto && Number(v.desconto_valor) > 0 && (
                                      <>
                                        <span className="text-[8px] text-[#D12D6C] bg-[#D12D6C]/10 border border-[#D12D6C]/20 uppercase font-bold tracking-widest px-1.5 py-0.5 rounded w-max mt-0.5">Desconto</span>
                                        <span className="text-[10px] text-rose-600 font-bold mt-0.5">
                                          - R$ {Number(v.desconto_valor).toFixed(2)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-xs text-[#29141B]/60 font-medium">
                                  {new Date(v.created_at).toLocaleDateString("pt-BR")} - {new Date(v.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </td>
                              </tr>
                            ))}
                            {vendas.length === 0 && (
                              <tr>
                                <td colSpan={5} className="text-center text-[#29141B]/60 py-12 font-medium bg-white">
                                  Nenhuma saída registrada ainda.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Visualização em Cards (Mobile) */}
                      <div className="block md:hidden flex flex-col gap-3">
                        {vendas.map(v => (
                          <div key={v.id} className="bg-white border border-[#EACAD6]/40 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:bg-[#FCFAF9]/50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div>
                                  <span className="block font-bold text-[#29141B] text-sm">{v.bolsas?.nome}</span>
                                  <span className="block text-[10px] text-[#29141B]/60">Cód: {v.bolsas?.codigo || "N/A"}</span>
                                </div>
                                {v.observacao && v.observacao.includes("[Trocada/Devolvida") && (
                                  <span 
                                    className="text-[8px] bg-rose-50 border border-rose-200 text-rose-600 font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 cursor-pointer hover:bg-rose-100 hover:border-rose-300 transition-all shadow-sm active:scale-95 flex items-center gap-0.5" 
                                    title="Clique para rastrear esta troca no histórico"
                                    onClick={() => handleRastrearTroca(v.bolsa_id, v.cliente_id)}
                                  >
                                    <span className="material-symbols-outlined text-[10px]">sync_alt</span>
                                    Devolvida
                                  </span>
                                )}
                                {v.forma_pagamento === "troca" && (
                                  <span className="text-[8px] bg-sky-50 border border-sky-200 text-sky-600 font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0">
                                    Troca
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 text-xs shrink-0">
                                  R$ {Number(v.preco_vendido).toFixed(2)}
                                </span>
                                {v.tinha_desconto && (
                                  <span className="text-[8px] text-[#D12D6C] bg-[#D12D6C]/10 border border-[#D12D6C]/20 uppercase font-bold tracking-widest px-1.5 py-0.5 rounded w-max">Promoção</span>
                                )}
                                {!v.tinha_desconto && Number(v.desconto_valor) > 0 && (
                                  <>
                                    <span className="text-[8px] text-[#D12D6C] bg-[#D12D6C]/10 border border-[#D12D6C]/20 uppercase font-bold tracking-widest px-1.5 py-0.5 rounded w-max">Desconto</span>
                                    <span className="text-[10px] text-rose-600 font-bold">
                                      - R$ {Number(v.desconto_valor).toFixed(2)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 border-t border-[#EACAD6]/30 pt-3 text-xs">
                              <div>
                                <span className="block text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50">Cliente</span>
                                <span className="text-[#29141B] font-medium block mt-0.5 truncate">{v.clientes?.nome || "Consumidor Geral"}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50">Data</span>
                                <span className="text-[#29141B]/70 font-medium block mt-0.5 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px] text-[#29141B]/60">calendar_month</span>
                                  {new Date(v.created_at).toLocaleDateString("pt-BR")} - {new Date(v.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </div>

                            <div className="border-t border-[#EACAD6]/30 pt-2.5 flex flex-col gap-1">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50">Vendedor</span>
                              {profile?.role === "admin" ? (
                                <select
                                  value={v.funcionario_id || ""}
                                  onChange={async (e) => {
                                    const newFid = e.target.value;
                                    try {
                                      const { error } = await supabase
                                        .from("vendas")
                                        .update({ funcionario_id: newFid || null })
                                        .eq("id", v.id);
                                      if (error) throw error;
                                      loadAllData();
                                    } catch (err) {
                                      alert("Erro ao atualizar vendedor: " + err.message);
                                    }
                                  }}
                                  className="w-full bg-white hover:bg-[#FCFAF9] text-[#29141B] border border-[#EACAD6] rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#D12D6C] focus:border-[#D12D6C] outline-none cursor-pointer shadow-sm transition-all"
                                >
                                  <option value="">Sem vendedor</option>
                                  {funcionarios.map(f => (
                                    <option key={f.id} value={f.id}>{f.nome}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-semibold text-[#29141B]/80 text-xs flex items-center gap-1.5 mt-0.5">
                                  <span className="material-symbols-outlined text-[14px] text-[#29141B]/60">person</span>
                                  {funcionarios.find(f => f.id === v.funcionario_id)?.nome || "Sem vendedor"}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {vendas.length === 0 && (
                          <div className="text-center text-[#29141B]/60 py-8 font-medium bg-white border border-[#EACAD6]/45 rounded-2xl shadow-sm">
                            Nenhuma saída registrada ainda.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* CLIENTES PAGE                                            */}
              {/* ======================================================== */}
              {activeTab === "clientes" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Left Column: Register Client */}
                  <div className="lg:col-span-1">
                    <section className="bg-white rounded-[24px] border border-[#EACAD6] shadow-[0_4px_12px_rgba(41,20,27,0.05)] p-6 flex flex-col gap-6">
                      <div className="flex items-center gap-3 border-b border-[#FCEEF3] pb-3">
                        <span className="material-symbols-outlined text-[#D12D6C] text-2xl">
                          {editingCliente ? "edit" : "person_add"}
                        </span>
                        <h2 className="text-xl font-extrabold text-[#29141B]">
                          {editingCliente ? "Editar Cliente" : "Cadastrar Cliente"}
                        </h2>
                      </div>
                      
                      <form onSubmit={handleSaveCliente} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider" htmlFor="cli-nome">Nome Completo</label>
                          <input 
                            id="cli-nome"
                            type="text" 
                            required 
                            value={formCliente.nome} 
                            onChange={e => setFormCliente({ ...formCliente, nome: e.target.value })} 
                            placeholder="Jane Doe" 
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider" htmlFor="cli-cpf">CPF / Identidade</label>
                          <input 
                            id="cli-cpf"
                            type="text" 
                            value={formCliente.cpf} 
                            onChange={e => setFormCliente({ ...formCliente, cpf: e.target.value })} 
                            placeholder="000.000.000-00" 
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider" htmlFor="cli-email">E-mail</label>
                          <input 
                            id="cli-email"
                            type="email" 
                            value={formCliente.email} 
                            onChange={e => setFormCliente({ ...formCliente, email: e.target.value })} 
                            placeholder="jane@example.com" 
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider" htmlFor="cli-telefone">Telefone</label>
                          <input 
                            id="cli-telefone"
                            type="text" 
                            value={formCliente.telefone} 
                            onChange={e => setFormCliente({ ...formCliente, telefone: e.target.value })} 
                            placeholder="(XX) 99999-9999" 
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                          />
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                          <button 
                            type="submit" 
                            className="w-full py-3.5 px-5 min-h-[48px] bg-gradient-to-r from-[#D12D6C] to-[#FC5897] hover:from-[#B8245D] hover:to-[#D12D6C] text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-[0_4px_14px_rgba(209,45,108,0.25)] hover:shadow-[0_8px_24px_rgba(209,45,108,0.35)] border border-white/10 transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 cursor-pointer group antialiased"
                          >
                            <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">
                              {editingCliente ? "save" : "add"}
                            </span>
                            {editingCliente ? "Salvar Alterações" : "Confirmar Cadastro"}
                          </button>

                          {editingCliente && (
                            <button 
                              type="button" 
                              onClick={() => {
                                setEditingCliente(null);
                                setFormCliente({ nome: "", telefone: "", email: "", cpf: "" });
                              }}
                              className="w-full py-3.5 px-5 min-h-[48px] bg-white hover:bg-[#FCFAF9] text-[#29141B]/75 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 border border-[#EACAD6] hover:border-[#EACAD6] shadow-[0_2px_8px_rgba(41,20,27,0.05)] hover:shadow-[0_4px_14px_rgba(41,20,27,0.1)] transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 cursor-pointer group antialiased"
                            >
                              <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">close</span>
                              Cancelar Edição
                            </button>
                          )}
                        </div>
                      </form>
                    </section>
                  </div>

                  {/* Right Column: Search & Clients List */}
                  <div className="lg:col-span-2 flex flex-col gap-4">
                    <section className="bg-white rounded-[24px] border border-[#EACAD6] shadow-[0_4px_12px_rgba(41,20,27,0.05)] p-6 flex flex-col gap-4">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FCEEF3] pb-3">
                        <div>
                          <h2 className="text-xl font-extrabold text-[#29141B]">Base de Clientes</h2>
                          <p className="text-xs text-[#29141B]/60">Lista de clientes cadastrados no sistema.</p>
                        </div>
                        
                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#29141B]/40 text-base">search</span>
                          <input 
                            type="text" 
                            value={searchQueryClientes} 
                            onChange={e => setSearchQueryClientes(e.target.value)} 
                            placeholder="Buscar por nome ou CPF..." 
                            className="pl-9 h-10 w-full rounded-xl border border-[#EACAD6] bg-[#FCFAF9] px-3 text-[#29141B] placeholder-[#29141B]/35 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                          />
                        </div>
                      </div>

                      {/* Card layout list */}
                      <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-1">
                        {clientes.filter(c => c.nome.toLowerCase().includes(searchQueryClientes.toLowerCase()) || (c.cpf && c.cpf.includes(searchQueryClientes))).map(c => (
                          <div 
                            key={c.id} 
                            className="bg-white border-2 border-[#FCEEF3] hover:border-[#EACAD6] rounded-2xl p-4 flex items-center justify-between hover:bg-[#FFEBF2]/10 transition-all shadow-[0_4px_12px_rgba(41,20,27,0.05)] hover:shadow-[0_6px_16px_rgba(41,20,27,0.08)]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#FCFAF9] border border-[#EACAD6] flex items-center justify-center text-[#29141B] font-bold shadow-inner">
                                {c.nome.substring(0,2).toUpperCase()}
                              </div>
                              <div>
                                <strong className="text-[#29141B] text-base block font-bold">{c.nome}</strong>
                                <span className="block text-xs text-[#29141B]/60 font-medium">
                                  {c.telefone || "Sem telefone"} {c.email ? `• ${c.email}` : ""}
                                </span>
                                {c.cpf && (
                                  <span className="block text-[10px] text-[#29141B]/45 font-mono mt-0.5">CPF: {c.cpf}</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => setSelectedClienteForHistory(c)}
                                className="p-1.5 rounded-lg bg-[#FCFAF9] border border-[#EACAD6] text-[#29141B] hover:text-[#D12D6C] transition-all flex items-center justify-center shadow-xs"
                                title="Ver Histórico de Compras"
                              >
                                <span className="material-symbols-outlined text-base">receipt_long</span>
                              </button>

                              <button 
                                onClick={() => {
                                  setEditingCliente(c);
                                  setFormCliente({
                                    nome: c.nome || "",
                                    telefone: c.telefone || "",
                                    email: c.email || "",
                                    cpf: c.cpf || ""
                                  });
                                  document.getElementById("cli-nome")?.focus();
                                }}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-600 hover:text-white transition-all flex items-center justify-center shadow-xs"
                                title="Editar Cliente"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>

                              {profile?.role === "admin" && (
                                <button 
                                  onClick={async () => {
                                    if (confirm(`Deseja realmente excluir o cliente ${c.nome}?`)) {
                                      const { error } = await supabase.from("clientes").delete().eq("id", c.id);
                                      if (error) alert("Erro ao excluir: " + error.message);
                                      else { alert("Cliente excluído com sucesso!"); loadAllData(); }
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 border border-rose-200 text-rose-600 hover:text-white transition-all flex items-center justify-center shadow-xs"
                                  title="Excluir Cliente"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {clientes.filter(c => c.nome.toLowerCase().includes(searchQueryClientes.toLowerCase()) || (c.cpf && c.cpf.includes(searchQueryClientes))).length === 0 && (
                          <div className="text-center text-[#29141B]/60 py-12 font-medium bg-white">
                            Nenhum cliente cadastrado correspondente.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TROCAS PAGE                                              */}
              {/* ======================================================== */}
              {activeTab === "troca" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Left Column: Register Form */}
                  <div className="lg:col-span-1">
                    <section className="bg-white rounded-[24px] border border-[#EACAD6] shadow-[0_4px_12px_rgba(41,20,27,0.05)] p-6 flex flex-col gap-6">
                      <div className="flex items-center gap-3 border-b border-[#FCEEF3] pb-3">
                        <span className="material-symbols-outlined text-[#D12D6C] text-2xl">assignment_return</span>
                        <h2 className="text-xl font-extrabold text-[#29141B]">Registrar Troca</h2>
                      </div>
                      
                      <form onSubmit={handleSaveTroca} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Cliente</label>
                          <select 
                            required 
                            value={formTroca.cliente_id} 
                            onChange={e => setFormTroca({ 
                              ...formTroca, 
                              cliente_id: e.target.value,
                              venda_id: "",
                              bolsa_devolvida_id: "",
                              bolsa_nova_id: ""
                            })}
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm cursor-pointer"
                          >
                            <option value="" disabled hidden>Selecione o cliente...</option>
                            {clientes.map(c => (
                              <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                          </select>
                        </div>

                        {/* Código de Etiqueta do Produto Devolvido */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Código da Etiqueta Devolvida</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#29141B]/40">tag</span>
                              <input 
                                type="text" 
                                placeholder="Digite o código..." 
                                value={codigoDevolvido} 
                                onChange={e => setCodigoDevolvido(e.target.value)} 
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleBuscarCodigoDevolvido();
                                  }
                                }}
                                className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white pl-9 pr-3 text-[#29141B] placeholder-[#29141B]/35 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                              />
                            </div>
                            <button 
                              type="button" 
                              onClick={handleBuscarCodigoDevolvido} 
                              className="h-11 px-4 rounded-xl bg-[#D12D6C] hover:bg-[#B8255B] text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                            >
                              <span className="material-symbols-outlined text-sm">search</span>
                              Buscar
                            </button>
                          </div>
                          {feedbackDevolvido && !feedbackDevolvido.success && (
                            <span className="text-[11px] font-semibold mt-1 flex items-start gap-1 leading-snug text-rose-600">
                              <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">error</span>
                              {feedbackDevolvido.message}
                            </span>
                          )}
                          
                          {/* Card Visual do Produto Devolvido */}
                          {formTroca.bolsa_devolvida_id && (() => {
                            const devolvida = bolsas.find(b => b.id === formTroca.bolsa_devolvida_id);
                            if (!devolvida) return null;
                            const vendaOrig = vendas.find(v => v.id === formTroca.venda_id);
                            const precoPagoOriginal = vendaOrig ? Number(vendaOrig.preco_vendido) : 0;
                            return (
                              <div className="mt-2 bg-[#FCFAF9] border border-[#FCEEF3] rounded-xl p-3 shadow-sm transition-all hover:border-[#D12D6C]/30 flex items-center justify-between">
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {devolvida.foto_url ? (
                                    <img src={devolvida.foto_url} alt={devolvida.nome} className="w-10 h-10 rounded-lg object-cover border border-[#FCEEF3] shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-[#FFEBF2] flex items-center justify-center shrink-0 text-[#D12D6C]">
                                      <span className="material-symbols-outlined text-sm">shopping_bag</span>
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-xs font-bold text-[#29141B] truncate">{devolvida.nome}</span>
                                    <span className="text-[10px] text-[#29141B]/60">Código: {devolvida.codigo}</span>
                                    {vendaOrig && (
                                      <span className="text-[10px] text-emerald-600 font-extrabold mt-0.5">
                                        Valor pago: R$ {precoPagoOriginal.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    setCodigoDevolvido("");
                                    setFeedbackDevolvido(null);
                                    setFormTroca(prev => ({ ...prev, venda_id: "", bolsa_devolvida_id: "" }));
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shrink-0 shadow-xs ml-2 cursor-pointer"
                                  title="Remover"
                                >
                                  <span className="material-symbols-outlined text-base">close</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Código de Etiqueta do Novo Produto */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider">Código da Etiqueta Novo (Saída)</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#29141B]/40">tag</span>
                              <input 
                                type="text" 
                                placeholder="Digite o código..." 
                                value={codigoNovo} 
                                onChange={e => setCodigoNovo(e.target.value)} 
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleBuscarCodigoNovo();
                                  }
                                }}
                                className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white pl-9 pr-3 text-[#29141B] placeholder-[#29141B]/35 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                              />
                            </div>
                            <button 
                              type="button" 
                              onClick={handleBuscarCodigoNovo} 
                              className="h-11 px-4 rounded-xl bg-[#D12D6C] hover:bg-[#B8255B] text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                            >
                              <span className="material-symbols-outlined text-sm">search</span>
                              Buscar
                            </button>
                          </div>
                          {feedbackNovo && !feedbackNovo.success && (
                            <span className="text-[11px] font-semibold mt-1 flex items-start gap-1 leading-snug text-rose-600">
                              <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">error</span>
                              {feedbackNovo.message}
                            </span>
                          )}
                          
                          {/* Card Visual do Novo Produto */}
                          {formTroca.bolsa_nova_id && (() => {
                            const nova = bolsas.find(b => b.id === formTroca.bolsa_nova_id);
                            if (!nova) return null;
                            const precoNova = nova.desconto_ativo && nova.preco_desconto ? Number(nova.preco_desconto) : Number(nova.preco_venda);
                            return (
                              <div className="mt-2 bg-[#FCFAF9] border border-[#FCEEF3] rounded-xl p-3 shadow-sm transition-all hover:border-[#D12D6C]/30 flex items-center justify-between">
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {nova.foto_url ? (
                                    <img src={nova.foto_url} alt={nova.nome} className="w-10 h-10 rounded-lg object-cover border border-[#FCEEF3] shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-[#FFEBF2] flex items-center justify-center shrink-0 text-[#D12D6C]">
                                      <span className="material-symbols-outlined text-sm">shopping_bag</span>
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-xs font-bold text-[#29141B] truncate">{nova.nome}</span>
                                    <span className="text-[10px] text-[#29141B]/60">Código: {nova.codigo}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] font-extrabold text-emerald-600">R$ {precoNova.toFixed(2)}</span>
                                      {nova.desconto_ativo && (
                                        <span className="text-[7px] bg-[#FFEBF2] text-[#D12D6C] font-extrabold tracking-widest uppercase px-1.5 py-0.5 rounded shrink-0">PROMO</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    setCodigoNovo("");
                                    setFeedbackNovo(null);
                                    setFormTroca(prev => ({ ...prev, bolsa_nova_id: "" }));
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shrink-0 shadow-xs ml-2 cursor-pointer"
                                  title="Remover"
                                >
                                  <span className="material-symbols-outlined text-base">close</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Campo de Desconto da Bolsa Nova */}
                        {formTroca.bolsa_nova_id && (
                          <div className="mt-2 flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider" htmlFor="exchange-discount">
                              Desconto Opcional para o Novo Item (R$)
                            </label>
                            <input 
                              id="exchange-discount"
                              type="number" 
                              min="0"
                              step="0.01"
                              value={formTroca.desconto_novo} 
                              onChange={e => {
                                const val = e.target.value === "" ? "" : Number(e.target.value);
                                setFormTroca({ ...formTroca, desconto_novo: val });
                              }} 
                              placeholder="0.00" 
                              className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                            />
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#29141B]/85 uppercase tracking-wider" htmlFor="exchange-reason">Motivo da Troca</label>
                          <input 
                            id="exchange-reason"
                            type="text" 
                            value={formTroca.motivo} 
                            onChange={e => setFormTroca({ ...formTroca, motivo: e.target.value })} 
                            placeholder="Ex: Tamanho incompatível / Defeito" 
                            className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] placeholder-[#29141B]/55 focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] focus:outline-none transition-all shadow-sm text-sm"
                          />
                        </div>

                        {/* Real-time Dynamic Exchange Valuation Preview */}
                        {formTroca.venda_id && formTroca.bolsa_nova_id && (() => {
                          const vendaOrig = vendas.find(v => v.id === formTroca.venda_id);
                          const precoPagoOriginal = vendaOrig ? Number(vendaOrig.preco_vendido) : 0;
                          
                          const nova = bolsas.find(b => b.id === formTroca.bolsa_nova_id);
                          const precoBaseNova = nova ? Number(nova.preco_venda) : 0;
                          const descontoNova = Number(formTroca.desconto_novo) || 0;
                          const precoNova = precoBaseNova - descontoNova;
                          
                          const diferenca = precoNova - precoPagoOriginal;
                          
                          return (
                            <div className="mt-2 p-4 rounded-2xl bg-[#FCFAF9] border border-[#FCEEF3] flex flex-col gap-2 transition-all duration-300 ease-in-out shadow-inner">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#D12D6C]">Resumo Financeiro da Troca</h4>
                              
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-[#29141B]/60 font-medium">Pago no Devolvido:</span>
                                <span className="font-bold text-[#29141B]">R$ {precoPagoOriginal.toFixed(2)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-[#29141B]/60 font-medium">Valor do Novo Produto:</span>
                                <span className="font-bold text-[#29141B]">
                                  R$ {precoNova.toFixed(2)}
                                  {descontoNova > 0 && (
                                    <span className="ml-1 text-[10px] text-emerald-600 font-bold">(Desconto de R$ {descontoNova.toFixed(2)} aplicado)</span>
                                  )}
                                </span>
                              </div>
                              
                              <div className="h-[1px] bg-[#29141B]/10 my-1" />
                              
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-[#29141B]">Saldo da Troca:</span>
                                {diferenca > 0 ? (
                                  <div className="text-right">
                                    <span className="font-extrabold text-emerald-600 text-sm">A Cobrar: R$ {diferenca.toFixed(2)}</span>
                                    <span className="block text-[9px] text-[#D12D6C]/80 font-medium">Cliente paga a diferença</span>
                                  </div>
                                ) : diferenca === 0 ? (
                                  <div className="text-right">
                                    <span className="font-extrabold text-emerald-600 text-sm">Troca Equivalente</span>
                                    <span className="block text-[9px] text-emerald-600/80 font-medium">Sem diferença de valor</span>
                                  </div>
                                ) : (
                                  <div className="text-right">
                                    <span className="font-extrabold text-sky-600 text-sm">Crédito: R$ {Math.abs(diferenca).toFixed(2)}</span>
                                    <span className="block text-[9px] text-sky-600/80 font-medium">Gerar crédito de loja</span>
                                  </div>
                                )}
                              </div>

                              {diferenca > 0 && (
                                <div className="mt-2 pt-2 border-t border-[#FCEEF3] flex flex-col gap-1.5">
                                  <label className="text-[10px] font-bold text-[#29141B]/60 uppercase tracking-wider">Forma de Pagamento da Diferença</label>
                                  <select 
                                    required 
                                    value={formTroca.forma_pagamento || "pix"} 
                                    onChange={e => setFormTroca({ ...formTroca, forma_pagamento: e.target.value })}
                                    className="h-10 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] text-xs outline-none cursor-pointer"
                                  >
                                    <option value="pix">Pix</option>
                                    <option value="credito">Cartão de Crédito</option>
                                    <option value="debito">Cartão de Débito</option>
                                    <option value="dinheiro">Dinheiro</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <button 
                          type="submit" 
                          className="mt-3 w-full py-3.5 px-5 min-h-[48px] bg-gradient-to-r from-[#D12D6C] to-[#FC5897] hover:from-[#B8245D] hover:to-[#D12D6C] text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-[0_4px_14px_rgba(209,45,108,0.25)] hover:shadow-[0_8px_24px_rgba(209,45,108,0.35)] border border-white/10 transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 cursor-pointer group antialiased"
                        >
                          <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">sync_alt</span>
                          Concluir Troca
                        </button>
                      </form>
                    </section>
                  </div>

                  {/* Right Column: History list */}
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <section className="bg-white rounded-[24px] border border-[#EACAD6] shadow-[0_4px_12px_rgba(41,20,27,0.05)] p-6 flex flex-col gap-4">
                      <div>
                        <h2 className="text-xl font-extrabold text-[#29141B]">Histórico de Trocas</h2>
                        <p className="text-xs text-[#29141B]/60">Movimentações de trocas e eventuais ajustes de caixa.</p>
                      </div>

                      {/* Visualização em Tabela (Desktop & Tablet) */}
                      <div className="hidden md:block overflow-x-auto border border-[#FCEEF3] rounded-2xl shadow-sm">
                        <table className="w-full text-sm border-collapse text-left bg-white">
                          <thead>
                            <tr className="bg-[#FCFAF9] border-b border-[#FCEEF3] text-[10px] font-bold uppercase tracking-widest text-[#29141B]/60">
                              <th className="p-3">Cliente</th>
                              <th className="p-3">Devolveu</th>
                              <th className="p-3">Levou</th>
                              <th className="p-3">Diferença a Pagar</th>
                              <th className="p-3">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trocas.map(t => (
                              <tr 
                                key={t.id} 
                                id={`troca-row-${t.id}`}
                                className={`border-b border-[#FCEEF3] transition-all duration-500 ${
                                  highlightedExchangeId === t.id 
                                    ? "bg-[#C9A84C]/15 border-l-4 border-l-[#C9A84C] font-semibold scale-[1.01] shadow-[0_2px_8px_rgba(201,168,76,0.15)] animate-pulse" 
                                    : "hover:bg-[#FFEBF2]/10"
                                }`}
                              >
                                <td className="p-3 font-bold text-[#29141B]">
                                  {t.clientes?.nome}
                                </td>
                                <td className="p-3">
                                  <span className="block font-bold text-[#29141B]">{t.devolvida?.nome}</span>
                                  <span className="block text-[10px] text-[#29141B]/60">Cód: {t.devolvida?.codigo}</span>
                                </td>
                                <td className="p-3">
                                  <span className="block font-bold text-[#29141B]">{t.nova?.nome}</span>
                                  <span className="block text-[10px] text-[#29141B]/60">Cód: {t.nova?.codigo}</span>
                                </td>
                                <td className="p-3">
                                  {Number(t.diferenca_valor) > 0 ? (
                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 w-fit text-xs block">
                                      R$ {Number(t.diferenca_valor).toFixed(2)}
                                    </span>
                                  ) : Number(t.diferenca_valor) < 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 w-fit text-[9px] uppercase tracking-wider block">Reembolso</span>
                                      <span className="text-sky-600 font-bold text-xs block">R$ {Math.abs(Number(t.diferenca_valor)).toFixed(2)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[#29141B]/60 font-medium text-xs">R$ 0.00</span>
                                  )}
                                </td>
                                <td className="p-3 text-xs text-[#29141B]/60 font-medium">
                                  {new Date(t.created_at).toLocaleDateString("pt-BR")} - {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </td>
                              </tr>
                            ))}
                            {trocas.length === 0 && (
                              <tr>
                                <td colSpan={5} className="text-center text-[#29141B]/60 py-12 font-medium bg-white">
                                  Nenhuma troca efetuada até o momento.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Visualização em Cards (Mobile) */}
                      <div className="block md:hidden flex flex-col gap-3">
                        {trocas.map(t => (
                          <div 
                            key={t.id} 
                            id={`troca-card-${t.id}`}
                            className={`border transition-all duration-500 rounded-2xl p-4 flex flex-col gap-3 shadow-sm ${
                              highlightedExchangeId === t.id 
                                ? "bg-[#C9A84C]/15 border-[#C9A84C] border-2 ring-2 ring-[#C9A84C]/30 scale-[1.02] animate-pulse" 
                                : "bg-white border-[#FCEEF3] hover:bg-[#FFEBF2]/10"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="block text-[9px] uppercase tracking-wider font-bold text-[#29141B]/50">Cliente</span>
                                <span className="block font-bold text-[#29141B] text-sm">{t.clientes?.nome}</span>
                              </div>
                              <div className="shrink-0">
                                {Number(t.diferenca_valor) > 0 ? (
                                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 text-xs block text-center">
                                    + R$ {Number(t.diferenca_valor).toFixed(2)}
                                  </span>
                                ) : Number(t.diferenca_valor) < 0 ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 text-[8px] uppercase tracking-wider block">Reembolso</span>
                                    <span className="text-sky-600 font-bold text-xs block">- R$ {Math.abs(Number(t.diferenca_valor)).toFixed(2)}</span>
                                  </div>
                                ) : (
                                  <span className="text-[#29141B]/60 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg text-xs font-semibold block text-center">
                                    Sem Ajuste
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 border-t border-[#FCEEF3] pt-3 text-xs">
                              <div className="bg-[#FCFAF9] p-2.5 rounded-xl border border-[#FCEEF3]">
                                <span className="block text-[9px] uppercase tracking-wider font-bold text-rose-500">Devolvida</span>
                                <span className="font-bold text-[#29141B] block mt-0.5 text-xs truncate">{t.devolvida?.nome}</span>
                                <span className="text-[9px] text-[#29141B]/60 font-mono block">Cód: {t.devolvida?.codigo}</span>
                              </div>
                              <div className="bg-[#FCFAF9] p-2.5 rounded-xl border border-[#FCEEF3]">
                                <span className="block text-[9px] uppercase tracking-wider font-bold text-emerald-500">Nova</span>
                                <span className="font-bold text-[#29141B] block mt-0.5 text-xs truncate">{t.nova?.nome}</span>
                                <span className="text-[9px] text-[#29141B]/60 font-mono block">Cód: {t.nova?.codigo}</span>
                              </div>
                            </div>

                            <div className="border-t border-[#FCEEF3] pt-2.5 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 text-[#29141B]/70 font-medium">
                                <span className="material-symbols-outlined text-[14px] text-[#29141B]/50">calendar_month</span>
                                <span>{new Date(t.created_at).toLocaleDateString("pt-BR")} - {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {trocas.length === 0 && (
                          <div className="text-center text-[#29141B]/60 py-8 font-medium bg-white border border-[#FCEEF3] rounded-2xl shadow-sm">
                            Nenhuma troca efetuada até o momento.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* REPORTS PAGE (ADMIN ONLY)                                */}
              {/* ======================================================== */}
              {activeTab === "relatorios" && (
                profile?.role === "admin" ? (
                  <div className="flex flex-col gap-6 print:gap-4 print:p-0">
                    
                    {/* Header dos Relatórios com Controles de Data */}
                    <section className="bg-white rounded-[24px] border border-[#FCEEF3] shadow-sm p-6 flex flex-col gap-6 print:hidden">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#FCEEF3] pb-4">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[#D12D6C] text-3xl">bar_chart</span>
                          <div>
                            <h2 className="text-xl font-extrabold text-[#29141B]">Relatório Consolidado de Vendas</h2>
                            <p className="text-xs text-[#29141B]/60">Filtre por período e visualize o faturamento por método de pagamento e produtos retirados.</p>
                          </div>
                        </div>
                        
                        <button 
                          onClick={handleImprimirRelatorio}
                          className="py-3 px-6 bg-gradient-to-r from-[#D12D6C] via-[#E23B7C] to-[#F44B8C] hover:from-[#B8255B] hover:to-[#D12D6C] text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-[0_6px_20px_rgba(209,45,108,0.2)] hover:shadow-[0_10px_28px_rgba(209,45,108,0.35)] border border-white/10 transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 cursor-pointer group antialiased shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">print</span>
                          Imprimir Relatório
                        </button>
                      </div>
                      
                      {/* Filtros rápidos e seletores de data */}
                      <div className="flex flex-col gap-4">
                        {/* Chips de períodos rápidos */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#29141B]/60 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">date_range</span>
                            Período Rápido:
                          </span>
                          
                          {[
                            { label: "Hoje", inicio: hojeStr, fim: hojeStr },
                            { label: "Ontem", inicio: ontemStr, fim: ontemStr },
                            { label: "Últimos 7 Dias", inicio: seteDiasStr, fim: hojeStr },
                            { label: "Este Mês", inicio: inicioMesStr, fim: hojeStr }
                          ].map((opcao) => {
                            const ativo = relatorioDataInicio === opcao.inicio && relatorioDataFim === opcao.fim;
                            return (
                              <button
                                key={opcao.label}
                                type="button"
                                onClick={() => {
                                  setRelatorioDataInicio(opcao.inicio);
                                  setRelatorioDataFim(opcao.fim);
                                }}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-150 active:scale-95 border ${
                                  ativo 
                                    ? "bg-[#D12D6C] text-white border-[#D12D6C] shadow-sm" 
                                    : "bg-[#FCFAF9] border-[#FCEEF3] text-[#29141B]/60 hover:border-[#D12D6C] hover:text-[#D12D6C] hover:bg-[#FFEBF2]/40"
                                }`}
                              >
                                {opcao.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Campos de input de data */}
                        <div className="flex flex-wrap items-end gap-4">
                          <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                            <label className="text-[#29141B]/80 font-bold uppercase text-xs">Data de Início</label>
                            <input 
                              type="date"
                              value={relatorioDataInicio}
                              onChange={(e) => setRelatorioDataInicio(e.target.value)}
                              className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] text-sm outline-none"
                            />
                          </div>
                          
                          <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                            <label className="text-[#29141B]/80 font-bold uppercase text-xs">Data de Fim</label>
                            <input 
                              type="date"
                              value={relatorioDataFim}
                              onChange={(e) => setRelatorioDataFim(e.target.value)}
                              className="h-11 w-full rounded-xl border border-[#EACAD6] bg-white px-3 text-[#29141B] focus:border-[#D12D6C] focus:ring-1 focus:ring-[#D12D6C] text-sm outline-none"
                            />
                          </div>
                          
                          <button 
                            onClick={() => {
                              loadAllData();
                            }}
                            className="bg-[#FCFAF9] border border-[#FCEEF3] text-[#29141B]/80 hover:text-[#D12D6C] hover:bg-[#FFEBF2]/40 px-5 h-11 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-sm animate-pulse-subtle"
                          >
                            <span className="material-symbols-outlined text-lg">refresh</span>
                            Atualizar Dados
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* Exibição apenas de impressão para Cabeçalho Corporativo */}
                    <div className="hidden print:flex flex-col gap-2 border-b-2 border-[#29141B]/40 pb-4 mb-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <h1 className="text-3xl font-extrabold text-[#D12D6C]">ZERO UM</h1>
                          <p className="text-xs uppercase font-extrabold tracking-widest text-[#29141B]/60">Stock & Sales Manager - Relatório Financeiro</p>
                        </div>
                        <div className="text-right text-xs text-[#29141B]/60 font-medium">
                          <p>Gerado em: {new Date().toLocaleString("pt-BR")}</p>
                          <p>Período: {new Date(relatorioDataInicio + "T00:00:00").toLocaleDateString("pt-BR")} a {new Date(relatorioDataFim + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                    </div>

                    {/* Total Faturado e Resumo Rápido */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white border border-[#FCEEF3] rounded-[24px] p-6 shadow-sm flex flex-col justify-between print:border-[#FCEEF3]">
                        <span className="text-[10px] uppercase font-extrabold text-[#29141B]/60 tracking-widest">Faturamento Total do Período</span>
                        <span className="text-3xl font-extrabold text-[#107C41] mt-2 block font-display-price">
                          R$ {relatorioStats.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-[#29141B]/60 mt-2 border-t border-[#FCEEF3] pt-1.5">
                          Total de receita bruta no período filtrado
                        </div>
                      </div>
                      
                      <div className="bg-white border border-[#FCEEF3] rounded-[24px] p-6 shadow-sm flex flex-col justify-between print:border-[#FCEEF3]">
                        <span className="text-[10px] uppercase font-extrabold text-[#29141B]/60 tracking-widest">Produtos Retirados (Saídas)</span>
                        <span className="text-3xl font-extrabold text-[#29141B] mt-2 block">
                          {relatorioStats.totalSair} <span className="text-xs font-semibold text-[#29141B]/60">unidades</span>
                        </span>
                        <div className="text-[10px] text-[#29141B]/60 mt-2 border-t border-[#FCEEF3] pt-1.5">
                          Itens que saíram do estoque físico
                        </div>
                      </div>

                      <div className="bg-white border border-[#FCEEF3] rounded-[24px] p-6 shadow-sm flex flex-col justify-between print:border-[#FCEEF3]">
                        <span className="text-[10px] uppercase font-extrabold text-[#29141B]/60 tracking-widest">Ticket Médio</span>
                        <span className="text-3xl font-extrabold text-[#107C41] mt-2 block font-display-price">
                          R$ {relatorioStats.totalSair > 0 
                            ? (relatorioStats.totalFaturado / relatorioStats.totalSair).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                            : "0,00"}
                        </span>
                        <div className="text-[10px] text-[#29141B]/60 mt-2 border-t border-[#FCEEF3] pt-1.5">
                          Valor médio por produto vendido
                        </div>
                      </div>
                    </div>

                    {/* Detalhamento por Forma de Pagamento */}
                    <section className="bg-white rounded-[24px] border border-[#EACAD6]/40 shadow-sm p-6 flex flex-col gap-6 print:border-[#EACAD6]/45">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#29141B]">Distribuição por Forma de Pagamento</h3>
                        <p className="text-xs text-[#29141B]/60 print:hidden">Estatísticas detalhadas de acordo com a forma de entrada de recursos.</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                          { key: "dinheiro", label: "Dinheiro", value: relatorioStats.dinheiro, icon: "payments", activeColor: "text-[#10B981]" },
                          { key: "debito", label: "Débito", value: relatorioStats.debito, icon: "credit_card", activeColor: "text-[#3B82F6]" },
                          { key: "credito", label: "Crédito", value: relatorioStats.credito, icon: "credit_card_heart", activeColor: "text-[#6366F1]" },
                          { key: "pix", label: "Pix", value: relatorioStats.pix, icon: "qr_code_2", activeColor: "text-[#0D9488]" },
                          { key: "boleto", label: "Boleto", value: relatorioStats.boleto || 0, icon: "receipt_long", activeColor: "text-[#F43F5E]" },
                          { key: "credito_parcelado", label: "Crédito Parcelado", value: relatorioStats.credito_parcelado, icon: "credit_score", activeColor: "text-[#8B5CF6]" },
                          { key: "credito_a_vista", label: "Crédito à Vista", value: relatorioStats.credito_a_vista, icon: "account_balance_wallet", activeColor: "text-[#06B6D4]" },
                          { key: "voucher", label: "Voucher", value: relatorioStats.voucher, icon: "confirmation_number", activeColor: "text-[#F59E0B]" },
                          { key: "pix_online", label: "Pix Online (Site)", value: relatorioStats.pix_online, icon: "language", activeColor: "text-[#14B8A6]" },
                        ].map((m) => {
                          const hasValue = m.value > 0;
                          const pct = relatorioStats.totalFaturado > 0 ? (m.value / relatorioStats.totalFaturado) * 100 : 0;
                          
                          // Estilos dinâmicos com base em possuir valor - Seguindo o padrão branco premium com letras pretas
                          const cardClass = hasValue
                            ? "bg-white border-[#FCEEF3] hover:border-[#FFEBF2] shadow-sm hover:shadow-md"
                            : "bg-white border-[#F3F4F6] shadow-sm opacity-60";
                          
                          const textClass = hasValue ? "text-[#107C41]" : "text-[#29141B]/40";
                          const labelClass = hasValue ? "text-[#29141B]" : "text-[#29141B]/50";
                          const iconClass = hasValue ? m.activeColor : "text-[#9CA3AF]";
                          const badgeClass = hasValue 
                            ? "text-[#107C41] bg-[#E8F8F0] border border-[#B3E6CC]/40" 
                            : "text-[#9CA3AF] bg-[#F9FAFB] border border-[#E5E7EB]/40";
                          
                          const barBgClass = hasValue ? "bg-[#E8F8F0]" : "bg-[#F3F4F6]";
                          const barColor = hasValue ? "#10B981" : "#D1D5DB";

                          return (
                            <div key={m.key} className={`rounded-2xl border p-4 flex flex-col gap-2 justify-between hover:scale-[1.02] duration-200 transition-all ${cardClass} print:border-[#EACAD6]/45`}>
                              <div className="flex items-center justify-between">
                                <span className={`material-symbols-outlined text-xl transition-colors ${iconClass}`}>{m.icon}</span>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${badgeClass}`}>
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="mt-1">
                                <strong className={`${labelClass} text-[11px] block font-bold uppercase tracking-wider`}>{m.label}</strong>
                                <span className={`text-lg font-extrabold font-display-price block mt-0.5 ${textClass}`}>
                                  R$ {m.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className={`w-full ${barBgClass} rounded-full h-1.5 overflow-hidden mt-1 print:border print:border-[#29141B]/20`}>
                                <div 
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%`, backgroundColor: pct > 0 ? barColor : "transparent" }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {/* 📊 Desempenho de Vendas por Vendedor */}
                    <section className="bg-white rounded-[24px] border border-[#EACAD6]/40 shadow-sm p-6 flex flex-col gap-6 print:border-[#EACAD6]/45">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#29141B] flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#D12D6C] print:hidden">workspace_premium</span>
                          Desempenho de Vendas por Colaborador
                        </h3>
                        <p className="text-xs text-[#29141B]/60 print:hidden">Relatório analítico de faturamento e quantidade vendida por cada vendedor no período selecionado.</p>
                      </div>

                      {/* Tabela de Ranking (Desktop) */}
                      <div className="hidden md:block overflow-x-auto border border-[#EACAD6]/35 rounded-2xl shadow-sm">
                        <table className="w-full text-sm border-collapse text-left bg-white">
                          <thead>
                            <tr className="bg-[#FCFAF9] border-b border-[#EACAD6]/40 text-[10px] font-bold uppercase tracking-widest text-[#29141B]/60">
                              <th className="p-3 w-16">Posição</th>
                              <th className="p-3">Colaborador</th>
                              <th className="p-3 text-right">Faturamento Total</th>
                              <th className="p-3 hidden lg:table-cell">Cargo</th>
                              <th className="p-3 text-center hidden sm:table-cell">Qtd. Vendida</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rankingVendedoresPeriodo.map((vend, idx) => (
                              <tr key={vend.id} className="border-b border-[#EACAD6]/30 hover:bg-[#FCFAF9]/50 transition-colors">
                                <td className="p-3 font-extrabold text-[#29141B]/60">
                                  {idx + 1}º
                                  {idx === 0 && <span className="material-symbols-outlined text-xs text-amber-500 ml-1 align-middle animate-pulse">star</span>}
                                </td>
                                <td className="p-3 font-bold text-[#29141B]">
                                  {vend.nome}
                                </td>
                                <td className="p-3 text-right font-extrabold text-emerald-700">
                                  R$ {vend.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-[#29141B]/60 capitalize text-xs hidden lg:table-cell">
                                  {vend.role === 'admin' ? 'Administrador' : 'Colaborador'}
                                </td>
                                <td className="p-3 text-center font-semibold text-[#29141B] hidden sm:table-cell">
                                  {vend.quantidade} un
                                </td>
                              </tr>
                            ))}
                            {rankingVendedoresPeriodo.length === 0 && (
                              <tr>
                                <td colSpan={5} className="text-center text-[#29141B]/60 py-12 font-medium bg-white">
                                  Nenhum colaborador registrado no período.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Lista de Ranking (Mobile - Sem necessidade de scroll lateral) */}
                      <div className="block md:hidden flex flex-col gap-3">
                        {rankingVendedoresPeriodo.map((vend, idx) => (
                          <div key={vend.id} className="bg-[#FCFAF9] border border-[#EACAD6]/40 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:bg-[#FCFAF9]/50 transition-colors">
                            <div className="flex items-center gap-3">
                              {/* Medalha / Posição */}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                                idx === 0 ? "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse" :
                                idx === 1 ? "bg-slate-100 text-slate-700 border border-slate-200" :
                                idx === 2 ? "bg-orange-100 text-orange-700 border border-orange-200" :
                                "bg-[#29141B]/5 text-[#29141B]/60"
                              }`}>
                                {idx + 1}º
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-[#29141B] truncate text-sm">{vend.nome}</span>
                                <span className="text-[10px] text-[#29141B]/50 font-semibold capitalize mt-0.5">
                                  {vend.role === 'admin' ? 'Administrador' : 'Colaborador'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end shrink-0">
                              <span className="font-extrabold text-emerald-700 text-sm">
                                R$ {vend.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-[#29141B]/60 font-semibold mt-0.5">
                                {vend.quantidade} un vendidas
                              </span>
                            </div>
                          </div>
                        ))}
                        {rankingVendedoresPeriodo.length === 0 && (
                          <div className="text-center text-[#29141B]/60 py-8 bg-white border border-[#EACAD6]/45 rounded-2xl font-medium shadow-sm">
                            Nenhum colaborador registrado no período.
                          </div>
                        )}
                      </div>
                    </section>

                    {/* ── Estoque Consolidado Atual ── */}
                    <section className="bg-white rounded-[24px] border border-[#EACAD6]/40 shadow-sm p-6 flex flex-col gap-4 print:border-[#EACAD6]/45 print:p-4 print:rounded-lg print-avoid-break">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#29141B] flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#D12D6C] print:hidden">inventory</span>
                          Estoque Consolidado Atual
                        </h3>
                        <p className="text-xs text-[#29141B]/60 print:hidden">Situação geral do estoque físico da loja hoje (independe do período selecionado).</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#FFF5F7] border border-[#FCEEF3] rounded-2xl p-4 flex flex-col gap-1 print:border-[#29141B]/20 print:bg-white print:rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#D12D6C] text-xl print:text-sm">shopping_bag</span>
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#29141B]/60">Total em Estoque</span>
                          </div>
                          <span className="text-2xl font-extrabold text-[#29141B] mt-1">
                            {bolsas.reduce((acc, b) => acc + (b.quantidade > 0 ? b.quantidade : 0), 0)} un
                          </span>
                          <span className="text-[10px] text-[#29141B]/50 font-semibold">
                            {bolsas.length} modelo{bolsas.length !== 1 ? 's' : ''} cadastrado{bolsas.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="bg-[#FCFAF9] border border-[#EACAD6]/40 rounded-2xl p-4 flex flex-col gap-1 print:border-[#29141B]/20 print:bg-white print:rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#475569] text-xl print:text-sm">payments</span>
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#29141B]/60">Valor Estimado</span>
                          </div>
                          <span className="text-2xl font-extrabold text-emerald-600 mt-1">
                            {bolsas.reduce((acc, b) => acc + (b.quantidade * Number(b.preco_venda)), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="text-[10px] text-[#29141B]/50 font-semibold">
                            Soma do preço de venda de todas as unidades
                          </span>
                        </div>
                      </div>
                    </section>

                    {/* ── Resumo Consolidado do Período ── */}
                    <section className="bg-white rounded-[24px] border border-[#EACAD6]/40 shadow-sm p-6 flex flex-col gap-6 print:border-[#EACAD6]/45 print:p-4 print:rounded-lg print-avoid-break">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#29141B] flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#D12D6C] print:hidden">analytics</span>
                          Resumo Consolidado do Período
                        </h3>
                        <p className="text-xs text-[#29141B]/60 print:hidden">Visão geral de todas as movimentações de estoque, vendas e trocas.</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Card Entradas */}
                        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-4 flex flex-col gap-1 print:border-[#29141B]/20 print:bg-white print:rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#16A34A] text-xl print:text-sm">inventory_2</span>
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#29141B]/60">Entradas</span>
                          </div>
                          <span className="text-2xl font-extrabold text-[#16A34A] mt-1">
                            {totalEntradasPeriodo}
                          </span>
                          <span className="text-[10px] text-[#29141B]/50 font-semibold">
                            {relatorioEntradas.length} registro{relatorioEntradas.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Card Saídas (Vendas) */}
                        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 flex flex-col gap-1 print:border-[#29141B]/20 print:bg-white print:rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#DC2626] text-xl print:text-sm">shopping_bag</span>
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#29141B]/60">Saídas</span>
                          </div>
                          <span className="text-2xl font-extrabold text-[#DC2626] mt-1">
                            {relatorioStats.totalSair}
                          </span>
                          <span className="text-[10px] text-[#29141B]/50 font-semibold">
                            unidades vendidas
                          </span>
                        </div>

                        {/* Card Trocas */}
                        <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-2xl p-4 flex flex-col gap-1 print:border-[#29141B]/20 print:bg-white print:rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#EA580C] text-xl print:text-sm">swap_horiz</span>
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#29141B]/60">Trocas</span>
                          </div>
                          <span className="text-2xl font-extrabold text-[#EA580C] mt-1">
                            {relatorioTrocas.length}
                          </span>
                          <span className="text-[10px] text-[#29141B]/50 font-semibold">
                            troca{relatorioTrocas.length !== 1 ? "s" : ""} efetuada{relatorioTrocas.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Card Saldo Líquido */}
                        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-4 flex flex-col gap-1 print:border-[#29141B]/20 print:bg-white print:rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#2563EB] text-xl print:text-sm">account_balance</span>
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#29141B]/60">Saldo Estoque</span>
                          </div>
                          <span className={`text-2xl font-extrabold mt-1 ${
                            (totalEntradasPeriodo - relatorioStats.totalSair) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                          }`}>
                            {totalEntradasPeriodo - relatorioStats.totalSair >= 0 ? "+" : ""}{totalEntradasPeriodo - relatorioStats.totalSair}
                          </span>
                          <span className="text-[10px] text-[#29141B]/50 font-semibold">
                            entradas - saídas
                          </span>
                        </div>
                      </div>
                    </section>

                    {/* ── Tabela de Entradas de Estoque ── */}
                    <section className="bg-white rounded-[24px] border border-[#EACAD6]/40 shadow-sm p-6 flex flex-col gap-6 print:border-[#EACAD6]/45 print:p-4 print:rounded-lg print-avoid-break">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#29141B] flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#16A34A] print:hidden">add_box</span>
                          Entradas de Estoque no Período
                        </h3>
                        <p className="text-xs text-[#29141B]/60 print:hidden">
                          Total de <strong>{totalEntradasPeriodo}</strong> unidades adicionadas em <strong>{relatorioEntradas.length}</strong> registro{relatorioEntradas.length !== 1 ? "s" : ""}.
                        </p>
                      </div>

                      {relatorioEntradas.length > 0 ? (
                        <div className="overflow-x-auto border border-[#EACAD6]/35 rounded-2xl shadow-sm print:border-[#29141B]/20 print:rounded-lg">
                          <table className="w-full text-sm border-collapse text-left bg-white print:print-table">
                            <thead>
                              <tr className="bg-[#FCFAF9] border-b border-[#EACAD6]/40 text-[10px] font-bold uppercase tracking-widest text-[#29141B]/60 print:bg-[#F9FAFB]">
                                <th className="p-3">Data</th>
                                <th className="p-3">Produto</th>
                                <th className="p-3 text-center">Qtd</th>
                                <th className="p-3 text-right">Custo Unit.</th>
                                <th className="p-3 hidden md:table-cell">Responsável</th>
                                <th className="p-3 hidden lg:table-cell">Observação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {relatorioEntradas.map((ent) => (
                                <tr key={ent.id} className="border-b border-[#EACAD6]/30 hover:bg-[#FCFAF9]/50 transition-colors print:border-[#29141B]/10">
                                  <td className="p-3 text-[#29141B] font-medium text-xs whitespace-nowrap">
                                    {new Date(ent.created_at).toLocaleDateString("pt-BR")}
                                  </td>
                                  <td className="p-3 text-[#29141B] font-bold text-xs">
                                    {ent.bolsas?.nome || "—"}
                                    <span className="block text-[10px] text-[#29141B]/50 font-medium">{ent.bolsas?.codigo || ""}</span>
                                  </td>
                                  <td className="p-3 text-center font-extrabold text-[#16A34A] text-sm">
                                    +{ent.quantidade}
                                  </td>
                                  <td className="p-3 text-right text-[#29141B]/80 font-semibold text-xs">
                                    {ent.preco_custo ? `R$ ${Number(ent.preco_custo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                                  </td>
                                  <td className="p-3 text-[#29141B]/60 text-xs hidden md:table-cell">
                                    {ent.profiles?.nome || "Sistema"}
                                  </td>
                                  <td className="p-3 text-[#29141B]/50 text-xs hidden lg:table-cell truncate max-w-[160px]">
                                    {ent.observacao || "—"}
                                  </td>
                                </tr>
                              ))}
                              {/* Total Footer */}
                              <tr className="bg-[#F0FDF4] border-t-2 border-[#16A34A]/30 print:bg-[#F9FAFB]">
                                <td colSpan={2} className="p-3 text-[10px] font-extrabold uppercase tracking-widest text-[#29141B]/60">
                                  Total de Entradas
                                </td>
                                <td className="p-3 text-center font-extrabold text-[#16A34A] text-lg">
                                  +{totalEntradasPeriodo}
                                </td>
                                <td colSpan={3} className="p-3"></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center text-[#29141B]/60 py-8 bg-[#FCFAF9] border border-[#EACAD6]/45 rounded-2xl font-medium shadow-sm">
                          <span className="material-symbols-outlined text-4xl text-[#29141B]/20 block mb-2">inbox</span>
                          Nenhuma entrada de estoque registrada no período selecionado.
                        </div>
                      )}
                    </section>

                    {/* ── Tabela de Trocas Efetuadas ── */}
                    <section className="bg-white rounded-[24px] border border-[#EACAD6]/40 shadow-sm p-6 flex flex-col gap-6 print:border-[#EACAD6]/45 print:p-4 print:rounded-lg print-avoid-break">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#29141B] flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#EA580C] print:hidden">swap_horiz</span>
                          Trocas Efetuadas no Período
                        </h3>
                        <p className="text-xs text-[#29141B]/60 print:hidden">
                          Total de <strong>{relatorioTrocas.length}</strong> troca{relatorioTrocas.length !== 1 ? "s" : ""} registrada{relatorioTrocas.length !== 1 ? "s" : ""}.
                        </p>
                      </div>

                      {relatorioTrocas.length > 0 ? (
                        <div className="overflow-x-auto border border-[#EACAD6]/35 rounded-2xl shadow-sm print:border-[#29141B]/20 print:rounded-lg">
                          <table className="w-full text-sm border-collapse text-left bg-white print:print-table">
                            <thead>
                              <tr className="bg-[#FCFAF9] border-b border-[#EACAD6]/40 text-[10px] font-bold uppercase tracking-widest text-[#29141B]/60 print:bg-[#F9FAFB]">
                                <th className="p-3">Data</th>
                                <th className="p-3">Cliente</th>
                                <th className="p-3">Devolvido</th>
                                <th className="p-3">Novo</th>
                                <th className="p-3 text-right">Diferença</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 hidden lg:table-cell">Motivo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {relatorioTrocas.map((troca) => {
                                const statusColors = {
                                  pendente: "bg-amber-50 text-amber-700 border-amber-200",
                                  concluida: "bg-emerald-50 text-emerald-700 border-emerald-200",
                                  cancelada: "bg-red-50 text-red-700 border-red-200"
                                };
                                const statusLabels = {
                                  pendente: "Pendente",
                                  concluida: "Concluída",
                                  cancelada: "Cancelada"
                                };
                                return (
                                  <tr key={troca.id} className="border-b border-[#EACAD6]/30 hover:bg-[#FCFAF9]/50 transition-colors print:border-[#29141B]/10">
                                    <td className="p-3 text-[#29141B] font-medium text-xs whitespace-nowrap">
                                      {new Date(troca.created_at).toLocaleDateString("pt-BR")}
                                    </td>
                                    <td className="p-3 text-[#29141B] font-bold text-xs">
                                      {troca.clientes?.nome || "—"}
                                    </td>
                                    <td className="p-3 text-xs">
                                      <span className="text-[#DC2626] font-semibold">{troca.devolvida?.nome || "—"}</span>
                                      <span className="block text-[10px] text-[#29141B]/50">{troca.devolvida?.codigo || ""}</span>
                                    </td>
                                    <td className="p-3 text-xs">
                                      <span className="text-[#16A34A] font-semibold">{troca.nova?.nome || "—"}</span>
                                      <span className="block text-[10px] text-[#29141B]/50">{troca.nova?.codigo || ""}</span>
                                    </td>
                                    <td className="p-3 text-right font-extrabold text-xs">
                                      <span className={Number(troca.diferenca_valor) > 0 ? "text-[#16A34A]" : Number(troca.diferenca_valor) < 0 ? "text-[#DC2626]" : "text-[#29141B]/60"}>
                                        {Number(troca.diferenca_valor) > 0 ? "+" : ""}R$ {Number(troca.diferenca_valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${statusColors[troca.status] || statusColors.pendente}`}>
                                        {statusLabels[troca.status] || troca.status}
                                      </span>
                                    </td>
                                    <td className="p-3 text-[#29141B]/50 text-xs hidden lg:table-cell truncate max-w-[160px]">
                                      {troca.motivo || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center text-[#29141B]/60 py-8 bg-[#FCFAF9] border border-[#EACAD6]/45 rounded-2xl font-medium shadow-sm">
                          <span className="material-symbols-outlined text-4xl text-[#29141B]/20 block mb-2">swap_horiz</span>
                          Nenhuma troca registrada no período selecionado.
                        </div>
                      )}
                    </section>

                    {/* ── Tabela Detalhada de Vendas (Visível na impressão e na tela) ── */}
                    <section className="bg-white rounded-[24px] border border-[#EACAD6]/40 shadow-sm p-6 flex flex-col gap-6 print:border-[#EACAD6]/45 print:p-4 print:rounded-lg">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#29141B] flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#D12D6C] print:hidden">receipt_long</span>
                          Detalhamento de Vendas
                        </h3>
                        <p className="text-xs text-[#29141B]/60 print:hidden">
                          Lista completa de <strong>{relatorioVendas.length}</strong> venda{relatorioVendas.length !== 1 ? "s" : ""} no período. Faturamento total: <strong className="text-[#107C41]">R$ {relatorioStats.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                        </p>
                      </div>

                      {relatorioVendas.length > 0 ? (
                        <div className="overflow-x-auto border border-[#EACAD6]/35 rounded-2xl shadow-sm print:border-[#29141B]/20 print:rounded-lg">
                          <table className="w-full text-sm border-collapse text-left bg-white print:print-table">
                            <thead>
                              <tr className="bg-[#FCFAF9] border-b border-[#EACAD6]/40 text-[10px] font-bold uppercase tracking-widest text-[#29141B]/60 print:bg-[#F9FAFB]">
                                <th className="p-3">Data</th>
                                <th className="p-3">Produto</th>
                                <th className="p-3 hidden md:table-cell">Vendedor</th>
                                <th className="p-3 hidden md:table-cell">Cliente</th>
                                <th className="p-3 hidden lg:table-cell text-center">Pagamento</th>
                                <th className="p-3 text-center hidden sm:table-cell">Desconto</th>
                                <th className="p-3 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {relatorioVendas.map((v) => (
                                <tr key={v.id} className="border-b border-[#EACAD6]/30 hover:bg-[#FCFAF9]/50 transition-colors print:border-[#29141B]/10">
                                  <td className="p-3 text-[#29141B] font-medium text-xs whitespace-nowrap">
                                    {new Date(v.created_at || v.data).toLocaleDateString("pt-BR")}
                                  </td>
                                  <td className="p-3 text-[#29141B] font-bold text-xs">
                                    {v.bolsas?.nome || "Produto Excluído"}
                                    <span className="block text-[10px] text-[#29141B]/50 font-medium">{v.bolsas?.codigo || ""}</span>
                                  </td>
                                  <td className="p-3 text-[#29141B]/70 text-xs hidden md:table-cell">
                                    {funcionarios.find(f => f.id === v.funcionario_id)?.nome || v.profiles?.nome || "Sistema"}
                                  </td>
                                  <td className="p-3 text-[#29141B]/70 text-xs hidden md:table-cell">
                                    {v.clientes?.nome || "—"}
                                  </td>
                                  <td className="p-3 text-xs text-center capitalize hidden lg:table-cell">
                                    <span className="px-2 py-0.5 rounded-md bg-[#FCFAF9] border border-[#EACAD6]/30 text-[10px] font-bold uppercase tracking-wider text-[#29141B]/70">
                                      {(v.forma_pagamento || "dinheiro").replace(/_/g, " ")}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center hidden sm:table-cell">
                                    {v.tinha_desconto ? (
                                      <span className="text-[10px] font-bold text-[#D12D6C] bg-[#FFEBF2] px-2 py-0.5 rounded-md border border-[#D12D6C]/15">
                                        -R$ {Number(v.desconto_valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-[#29141B]/30">—</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-extrabold text-[#107C41] text-sm">
                                    R$ {Number(v.preco_vendido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                              {/* Linha de totais */}
                              <tr className="bg-[#F0FDF4] border-t-2 border-[#107C41]/30 print:bg-[#F9FAFB]">
                                <td colSpan={2} className="p-3 text-[10px] font-extrabold uppercase tracking-widest text-[#29141B]/60">
                                  Total ({relatorioVendas.length} vendas)
                                </td>
                                <td className="p-3 hidden md:table-cell"></td>
                                <td className="p-3 hidden md:table-cell"></td>
                                <td className="p-3 hidden lg:table-cell"></td>
                                <td className="p-3 text-center hidden sm:table-cell text-[10px] font-bold text-[#D12D6C]">
                                  {relatorioVendas.filter(v => v.tinha_desconto).length > 0 && (
                                    <>-R$ {relatorioVendas.reduce((acc, v) => acc + (Number(v.desconto_valor) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</>
                                  )}
                                </td>
                                <td className="p-3 text-right font-extrabold text-[#107C41] text-lg">
                                  R$ {relatorioStats.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center text-[#29141B]/60 py-8 bg-[#FCFAF9] border border-[#EACAD6]/45 rounded-2xl font-medium shadow-sm">
                          <span className="material-symbols-outlined text-4xl text-[#29141B]/20 block mb-2">receipt_long</span>
                          Nenhuma venda registrada no período selecionado.
                        </div>
                      )}
                    </section>

                    {/* ── Rodapé de Impressão (Somente visível no PDF) ── */}
                    <div className="hidden print:block border-t-2 border-[#29141B]/30 pt-4 mt-4">
                      <div className="flex justify-between items-end text-[10px] text-[#29141B]/50">
                        <div>
                          <p className="font-extrabold text-[#D12D6C] text-sm">ZERO UM</p>
                          <p>Stock & Sales Manager — Relatório Financeiro</p>
                        </div>
                        <div className="text-right">
                          <p>Gerado em: {new Date().toLocaleString("pt-BR")}</p>
                          <p>Impresso por: {profile?.nome || "Admin"}</p>
                          <p className="font-bold mt-1">Documento confidencial — uso interno</p>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="bg-white rounded-[24px] border border-red-100 shadow-sm p-8 text-center flex flex-col items-center justify-center gap-4 max-w-lg mx-auto">
                    <span className="material-symbols-outlined text-6xl text-red-600 bg-red-50 p-4 rounded-full border border-red-100">lock</span>
                    <h2 className="text-xl font-extrabold text-[#29141B]">Acesso Restrito</h2>
                    <p className="text-xs text-[#29141B]/60 leading-relaxed">
                      Esta área é reservada exclusivamente para o **Administrador Geral** do sistema Zero Um.
                      Se você é gerente, certifique-se de que sua conta possui privilégios de administrador ativos.
                    </p>
                  </div>
                )
              )}

              {/* ======================================================== */}
              {/* STAFF PAGE (ADMIN ONLY)                                  */}
              {/* ======================================================== */}
              {activeTab === "funcionarios" && (
                profile?.role === "admin" ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Left Column: Register Form */}
                  <div className="lg:col-span-1">
                    <section className="bg-white rounded-3xl border border-[#EACAD6] shadow-[0_8px_30px_rgb(41,20,27,0.06)] p-6 relative overflow-hidden transition-all duration-300 hover:shadow-[0_12px_40px_rgb(41,20,27,0.1)] flex flex-col gap-5">
                      {/* Linha de destaque decorativa no topo */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#D12D6C] via-[#FC5897] to-[#D12D6C]" />
                      
                      <div className="flex flex-col gap-3 border-b border-[#FCEEF3] pb-4 pt-1">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[#D12D6C] text-2xl bg-[#D12D6C]/10 p-2 rounded-xl border border-[#D12D6C]/20">
                          {editingFuncionario ? "edit_square" : "badge"}
                          </span>
                          <div>
                            <h2 className="text-lg font-extrabold text-[#29141B] tracking-tight">
                              {editingFuncionario ? "Atualizar Cadastro" : "Registrar Funcionário"}
                            </h2>
                            <p className="text-[10px] text-[#29141B]/60 font-semibold tracking-wide mt-0.5">
                              {editingFuncionario ? `Editando dados de ${editingFuncionario.nome}` : "Gestão de acessos à equipe Zero Um"}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <form autoComplete="off" onSubmit={async (e) => {
                        e.preventDefault();
                        if (editingFuncionario) {
                          // MODO EDIÇÃO
                          if (!formFuncionario.nome) {
                            alert("O nome do funcionário é obrigatório!");
                            return;
                          }
                          if (formFuncionario.password && formFuncionario.password.length < 6) {
                            alert("A nova senha do funcionário deve ter no mínimo 6 caracteres!");
                            return;
                          }
                          try {
                            // 1. Atualizar profiles
                            const { error: profileError } = await supabase
                              .from("profiles")
                              .update({
                                nome: formFuncionario.nome,
                                role: formFuncionario.role,
                                telefone: formFuncionario.telefone || null
                              })
                              .eq("id", editingFuncionario.id);

                            if (profileError) throw profileError;

                            // 2. Se digitou senha, atualiza no auth.users via RPC
                            if (formFuncionario.password) {
                              const { error: rpcError } = await supabase.rpc("change_user_password", {
                                user_id: editingFuncionario.id,
                                new_password: formFuncionario.password
                              });
                              if (rpcError) throw rpcError;
                            }

                            alert("Cadastro do funcionário atualizado com sucesso!");
                            setEditingFuncionario(null);
                            setFormFuncionario({ email: "", password: "", nome: "", role: "funcionario", telefone: "" });
                            setShowPassword(false);
                            loadAllData();
                          } catch (err) {
                            alert("Erro ao atualizar funcionário: " + err.message);
                          }
                        } else {
                          // MODO CADASTRO ORIGINAL
                          if (!formFuncionario.nome || !formFuncionario.email || !formFuncionario.password) {
                            alert("Preencha todos os campos obrigatórios (Nome, E-mail e Senha)!");
                            return;
                          }
                          if (formFuncionario.password.length < 6) {
                            alert("A senha do funcionário deve ter no mínimo 6 caracteres!");
                            return;
                          }
                          try {
                            const tempSupabase = createClient(
                              import.meta.env.VITE_SUPABASE_URL,
                              import.meta.env.VITE_SUPABASE_ANON_KEY,
                              { auth: { persistSession: false } }
                            );

                            const { data: authData, error: signUpError } = await tempSupabase.auth.signUp({
                              email: formFuncionario.email,
                              password: formFuncionario.password,
                              options: {
                                data: {
                                  nome: formFuncionario.nome,
                                  role: formFuncionario.role,
                                  telefone: formFuncionario.telefone || null
                                }
                              }
                            });

                            if (signUpError) throw signUpError;

                            alert("Funcionário cadastrado com sucesso! Ele já pode fazer login direto com o e-mail e a senha cadastrados.");
                            setFormFuncionario({ email: "", password: "", nome: "", role: "funcionario", telefone: "" });
                            setShowPassword(false);
                            loadAllData();
                          } catch (err) {
                            alert("Erro ao cadastrar funcionário: " + err.message);
                          }
                        }
                      }} className="flex flex-col gap-4">
                        {/* Fake inputs to prevent browser autocomplete */}
                        <input type="text" name="prevent_autofill" id="prevent_autofill" value="" style={{ display: 'none' }} readOnly />
                        <input type="password" name="prevent_autofill_pwd" id="prevent_autofill_pwd" value="" style={{ display: 'none' }} readOnly />

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-extrabold tracking-wider uppercase text-[#29141B]/60 px-0.5 select-none" htmlFor="st-nome">Nome Completo</label>
                          <input 
                            id="st-nome"
                            type="text" 
                            required 
                            value={formFuncionario.nome} 
                            onChange={e => setFormFuncionario({ ...formFuncionario, nome: e.target.value })} 
                            placeholder="e.g. Jane Doe" 
                            className="h-11 w-full rounded-xl border-2 border-[#EACAD6] bg-[#FCFAF9] hover:bg-white hover:border-[#D12D6C]/50 focus:border-[#D12D6C] focus:bg-white px-3.5 text-[#29141B] text-xs font-bold outline-none transition-all duration-200 focus:shadow-[0_0_0_3px_rgba(209,45,108,0.15)]"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-extrabold tracking-wider uppercase text-[#29141B]/60 px-0.5 select-none" htmlFor="st-email">
                            E-mail de Acesso {editingFuncionario ? "" : "*"}
                          </label>
                          <input 
                            id="st-email"
                            type="email" 
                            autoComplete="new-email"
                            required={!editingFuncionario} 
                            disabled={!!editingFuncionario}
                            value={editingFuncionario ? "email@protegido.com" : formFuncionario.email} 
                            onChange={e => setFormFuncionario({ ...formFuncionario, email: e.target.value })} 
                            placeholder={editingFuncionario ? "E-mail não editável por segurança" : "e.g. email@colaborador.com"} 
                            className={`h-11 w-full rounded-xl border-2 border-[#EACAD6] bg-[#FCFAF9] px-3.5 text-[#29141B] text-xs font-bold outline-none transition-all duration-200 ${editingFuncionario ? "opacity-60 cursor-not-allowed border-[#EACAD6]/40 text-[#29141B]/50" : "hover:bg-white hover:border-[#D12D6C]/50 focus:border-[#D12D6C] focus:bg-white focus:shadow-[0_0_0_3px_rgba(209,45,108,0.15)]"}`}
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-extrabold tracking-wider uppercase text-[#29141B]/60 px-0.5 select-none" htmlFor="st-senha">
                            {editingFuncionario ? "Nova Senha (deixe em branco para manter)" : "Senha Provisória *"}
                          </label>
                          <div className="relative">
                            <input 
                              id="st-senha"
                              type={showPassword ? "text" : "password"} 
                              autoComplete="new-password"
                              required={!editingFuncionario} 
                              value={formFuncionario.password} 
                              onChange={e => setFormFuncionario({ ...formFuncionario, password: e.target.value })} 
                              placeholder={editingFuncionario ? "Nova senha do colaborador" : "Mínimo 6 caracteres"} 
                              className="h-11 w-full rounded-xl border-2 border-[#EACAD6] bg-[#FCFAF9] hover:bg-white hover:border-[#D12D6C]/50 focus:border-[#D12D6C] focus:bg-white pl-3.5 pr-10 text-[#29141B] text-xs font-bold outline-none transition-all duration-200 focus:shadow-[0_0_0_3px_rgba(209,45,108,0.15)]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#29141B]/60 hover:text-[#D12D6C] transition-colors focus:outline-none flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-lg select-none">
                                {showPassword ? "visibility" : "visibility_off"}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-extrabold tracking-wider uppercase text-[#29141B]/60 px-0.5 select-none" htmlFor="st-telefone">Telefone</label>
                          <input 
                            id="st-telefone"
                            type="text" 
                            value={formFuncionario.telefone} 
                            onChange={e => setFormFuncionario({ ...formFuncionario, telefone: e.target.value })} 
                            placeholder="e.g. (21) 98888-7777" 
                            className="h-11 w-full rounded-xl border-2 border-[#EACAD6] bg-[#FCFAF9] hover:bg-white hover:border-[#D12D6C]/50 focus:border-[#D12D6C] focus:bg-white px-3.5 text-[#29141B] text-xs font-bold outline-none transition-all duration-200 focus:shadow-[0_0_0_3px_rgba(209,45,108,0.15)]"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-extrabold tracking-wider uppercase text-[#29141B]/60 px-0.5 select-none">Cargo / Perfil</label>
                          <div className="relative">
                            <select 
                              value={formFuncionario.role} 
                              onChange={e => setFormFuncionario({ ...formFuncionario, role: e.target.value })}
                              className="h-11 w-full rounded-xl border-2 border-[#EACAD6] bg-[#FCFAF9] hover:bg-white hover:border-[#D12D6C]/50 focus:border-[#D12D6C] focus:bg-white px-3.5 text-[#29141B] text-xs font-bold outline-none transition-all duration-200 focus:shadow-[0_0_0_3px_rgba(209,45,108,0.15)] cursor-pointer appearance-none"
                            >
                              <option value="funcionario">Funcionário de Estoque</option>
                              <option value="admin">Administrador Geral</option>
                            </select>
                            <span className="material-symbols-outlined text-[#29141B]/60 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none select-none text-base">keyboard_arrow_down</span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-4">
                          {editingFuncionario && (
                            <button 
                              type="button" 
                              onClick={() => {
                                setEditingFuncionario(null);
                                setFormFuncionario({ email: "", password: "", nome: "", role: "funcionario", telefone: "" });
                                setShowPassword(false);
                              }}
                              className="py-3 px-5 min-h-[48px] bg-[#FCFAF9] hover:bg-[#FFEBF2]/10 text-[#29141B] hover:text-[#D12D6C] rounded-2xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 border-2 border-[#EACAD6] hover:border-[#D12D6C]/30 transition-all duration-200 cursor-pointer sm:w-1/3 w-full"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                              Cancelar
                            </button>
                          )}
                          <button 
                            type="submit" 
                            className={`py-3 px-5 min-h-[48px] bg-gradient-to-r from-[#D12D6C] to-[#FC5897] text-white rounded-2xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(209,45,108,0.25)] hover:shadow-[0_6px_20px_rgba(209,45,108,0.35)] border border-white/10 transition-all duration-300 hover:from-[#FC5897] hover:to-[#D12D6C] hover:scale-[1.01] hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0 whitespace-nowrap cursor-pointer group ${editingFuncionario ? "flex-1" : "w-full"}`}
                          >
                            <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">
                              {editingFuncionario ? "save" : "add"}
                            </span>
                            {editingFuncionario ? "Salvar Alterações" : "Registrar Funcionário"}
                          </button>
                        </div>
                        <p className="text-[10px] text-[#29141B]/50 leading-normal text-center mt-1 px-1 font-semibold">
                          * Nota: O funcionário poderá logar imediatamente com o e-mail e senha cadastrados acima.
                        </p>
                      </form>
                    </section>
                  </div>

                  {/* Right Column: Staff list */}
                  <div className="lg:col-span-2 flex flex-col gap-4">
                    <section className="bg-white rounded-[24px] border border-[#EACAD6] shadow-[0_4px_12px_rgba(41,20,27,0.05)] p-6 flex flex-col gap-4">
                      <div>
                        <h2 className="text-xl font-extrabold text-[#29141B]">Lista de Colaboradores</h2>
                        <p className="text-xs text-[#29141B]/60">Gerencie permissões e status de acesso dos funcionários.</p>
                      </div>

                      <div className="grid gap-3">
                        {funcionarios.map(f => (
                          <div 
                            key={f.id} 
                            className="bg-[#FCFAF9] border border-[#FCEEF3] rounded-2xl p-4 flex items-center justify-between hover:bg-[#FFEBF2]/10 transition-colors shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#FCFAF9] text-[#29141B] border border-[#EACAD6] flex items-center justify-center font-bold">
                                <span className="material-symbols-outlined text-lg">person</span>
                              </div>
                              <div>
                                <strong className="text-[#29141B] text-base block font-bold">{f.nome}</strong>
                                <span className="block text-xs text-[#29141B]/60">
                                  Telefone: {f.telefone || "Não cadastrado"}
                                </span>
                                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border mt-1.5 inline-block transition-all duration-300 ${
                                  f.role === 'admin' 
                                    ? 'bg-gradient-to-r from-[#D12D6C] to-[#FC5897] text-white border-transparent shadow-[0_2px_8px_rgba(209,45,108,0.15)]' 
                                    : 'bg-[#FFEBF2] text-[#D12D6C] border-[#FAD6E5]'
                                }`}>
                                  {f.role === 'admin' ? 'Administrador' : 'Colaborador'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex items-center gap-1.5 mr-2">
                                <span className="text-[10px] text-[#29141B]/60 font-bold uppercase tracking-wider">{f.ativo ? "Ativo" : "Bloqueado"}</span>
                                <input 
                                  type="checkbox" 
                                  checked={f.ativo} 
                                  onChange={(e) => handleToggleFuncionarioStatus(f.id, e.target.checked)}
                                  className="w-4 h-4 cursor-pointer accent-[#D12D6C] border-[#EACAD6] rounded"
                                />
                              </div>
                              
                              <button 
                                onClick={() => {
                                  setEditingFuncionario(f);
                                  setFormFuncionario({
                                    email: "", // email é desabilitado no form
                                    password: "", // deixa a senha em branco na edição
                                    nome: f.nome,
                                    role: f.role,
                                    telefone: f.telefone || ""
                                  });
                                  setShowPassword(false);
                                  document.getElementById("st-nome")?.focus();
                                  document.getElementById("st-nome")?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-600 hover:text-white transition-all flex items-center justify-center shadow-xs"
                                title="Editar colaborador"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              
                              <button 
                                onClick={async () => {
                                  if (confirm(`Deseja realmente deletar a conta de ${f.nome}?`)) {
                                    const { error } = await supabase.from("profiles").delete().eq("id", f.id);
                                    if (error) {
                                      alert("Erro ao remover funcionário: " + error.message);
                                    } else {
                                      alert("Funcionário removido com sucesso!");
                                      loadAllData();
                                    }
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 border border-rose-200 text-rose-600 hover:text-white transition-all flex items-center justify-center shadow-xs"
                                title="Remover conta"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
                ) : (
                  <div className="bg-white rounded-[24px] border border-[#FCEEF3] shadow-sm p-8 text-center flex flex-col items-center justify-center gap-4 max-w-lg mx-auto">
                    <span className="material-symbols-outlined text-6xl text-red-500 bg-[#FFEBF2] p-4 rounded-full border border-[#FAD6E5]">lock</span>
                    <h2 className="text-xl font-extrabold text-[#29141B]">Acesso Restrito</h2>
                    <p className="text-xs text-[#29141B]/60 leading-relaxed">
                      Esta área é reservada exclusivamente para o **Administrador Geral** do sistema Zero Um.
                      Se você é gerente, certifique-se de que sua conta possui privilégios de administrador ativos.
                    </p>
                  </div>
                )
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation Bar (Fixed bottom) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-2 py-3 bg-surface border-t border-outline-variant z-40 shadow-lg print:hidden">
        {renderBottomNavItem("dashboard", "Painel", "home")}
        {renderBottomNavItem("estoque", "Estoque", "shopping_bag")}
        {renderBottomNavItem("clientes", "Clientes", "person_search")}
        {renderBottomNavItem("saidas", "Vendas", "sell")}
        {profile?.role === "admin" && renderBottomNavItem("relatorios", "Relatórios", "bar_chart")}
        {renderBottomNavItem("troca", "Trocas", "assignment_return")}
      </nav>

      {/* ── Admin FAB for quick stock actions (Mobile only) ── */}
      {profile?.role === "admin" && (
        <button 
          onClick={() => {
            setActiveTab("estoque");
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label="Add Product" 
          className="md:hidden fixed bottom-20 right-4 bg-secondary text-on-secondary w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-30 print:hidden"
        >
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      )}

      {/* ── CAMERA SCANNER MODAL OVERLAY ── */}
      <AnimatePresence>
        {showScanner && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl w-full max-w-lg p-6 flex flex-col gap-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-outline-variant pb-2">
                <h3 className="font-bold text-on-surface text-lg font-headline-md">Escanear Código de Barras</h3>
                <button 
                  onClick={() => {
                    const reader = document.getElementById("reader");
                    if (reader) reader.innerHTML = ""; // Force clean scanner container
                    setShowScanner(false);
                  }} 
                  className="p-1.5 rounded-full hover:bg-error-container hover:text-on-error-container transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div id="reader" className="w-full bg-[#000] rounded-lg overflow-hidden border border-outline-variant" style={{ minHeight: "280px" }}></div>
              <p className="text-xs text-on-surface-variant text-center leading-normal">
                Aponte a câmera traseira do celular para o código de barras ou QR Code da etiqueta. A detecção ocorrerá automaticamente.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRODUCT DETAILS VIEW MODAL OVERLAY (Premium) ── */}
      <AnimatePresence>
        {selectedBolsaForView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBolsaForView(null)}
              className="absolute inset-0 bg-[#0c0c16]/80 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-surface-container-lowest border border-outline-variant w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col md:flex-row"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedBolsaForView(null)}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-surface-container-high/80 hover:bg-surface-container-highest border border-outline-variant flex items-center justify-center text-on-surface hover:text-secondary transition-colors"
                title="Fechar"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>

              {/* Left Column: Photo Viewer */}
              <div className="w-full md:w-1/2 bg-background p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-outline-variant relative">
                <div className="w-full h-64 md:h-80 rounded-xl overflow-hidden border border-outline-variant/60 flex items-center justify-center relative bg-surface-container-lowest group/zoom cursor-zoom-in">
                  {selectedBolsaForView.foto_url ? (
                    <img 
                      src={selectedBolsaForView.foto_url} 
                      alt={selectedBolsaForView.nome} 
                      className="w-full h-full object-cover group-hover/zoom:scale-125 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-on-surface-variant gap-2">
                      <span className="material-symbols-outlined text-5xl">shopping_bag</span>
                      <span className="text-sm font-medium">Sem Imagem Cadastrada</span>
                    </div>
                  )}
                  
                  {selectedBolsaForView.desconto_ativo && (
                    <div className="absolute top-3 left-3 bg-green-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                      <span className="material-symbols-outlined text-xs">local_offer</span>
                      PROMO
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Specification Sheet */}
              <div className="w-full md:w-1/2 p-6 flex flex-col justify-between">
                <div>
                  {/* Brand & SKU */}
                  <div className="flex items-center justify-between gap-2 mb-2 md:pr-10">
                    <span className="text-xs font-bold text-secondary uppercase tracking-widest">
                      {selectedBolsaForView.marca || "Sem Marca"}
                    </span>
                    <span className="bg-secondary/15 border border-secondary/30 text-secondary text-[11px] px-2.5 py-0.5 rounded font-mono font-bold uppercase">
                      {selectedBolsaForView.codigo}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-extrabold text-on-surface mb-4 leading-tight">
                    {selectedBolsaForView.nome}
                  </h2>

                  {/* Grid of specs */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-surface-container-low/50 border border-outline-variant/40 rounded-lg p-2.5">
                      <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Cor</span>
                      <span className="text-xs font-semibold text-on-surface">{selectedBolsaForView.cor || "-"}</span>
                    </div>
                    <div className="bg-surface-container-low/50 border border-outline-variant/40 rounded-lg p-2.5">
                      <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Tamanho</span>
                      <span className="text-xs font-semibold text-on-surface">{selectedBolsaForView.tamanho || "-"}</span>
                    </div>
                    <div className="bg-surface-container-low/50 border border-outline-variant/40 rounded-lg p-2.5 col-span-2">
                      <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Material</span>
                      <span className="text-xs font-semibold text-on-surface">{selectedBolsaForView.material || "-"}</span>
                    </div>
                  </div>

                  {/* Prices */}
                  <div className="flex items-center gap-4 mb-6 border-t border-b border-outline-variant/60 py-3">
                    <div className="flex-1">
                      <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Preço de Venda</span>
                      {selectedBolsaForView.desconto_ativo && selectedBolsaForView.preco_desconto ? (
                        <div className="flex flex-col">
                          <span className="line-through text-xs text-on-surface-variant">R$ {Number(selectedBolsaForView.preco_venda).toFixed(2)}</span>
                          <span className="font-extrabold text-secondary text-base">R$ {Number(selectedBolsaForView.preco_desconto).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="font-extrabold text-on-surface text-base">R$ {Number(selectedBolsaForView.preco_venda).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock Status & Actions */}
                <div className="flex items-center justify-between gap-4 mt-auto">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-1">Estoque Disponível</span>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${selectedBolsaForView.quantidade <= Math.max(Number(selectedBolsaForView.quantidade_minima || 0), 2) ? "badge-danger" : "badge-primary"}`}>
                        {selectedBolsaForView.quantidade} unidades
                      </span>
                      {selectedBolsaForView.quantidade <= Math.max(Number(selectedBolsaForView.quantidade_minima || 0), 2) && (
                        <span className="text-[10px] text-error font-medium flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-xs">warning</span>
                          Baixo Estoque
                        </span>
                      )}
                    </div>
                  </div>

                  {profile?.role === "admin" && (
                    <button 
                      onClick={() => {
                        const b = selectedBolsaForView;
                        setSelectedBolsaForView(null);
                        setEditingBolsa(b);
                        setFormBolsa({
                          codigo: b.codigo || "",
                          nome: b.nome || "",
                          marca: b.marca || "",
                          cor: b.cor || "",
                          tamanho: b.tamanho || "",
                          material: b.material || "",
                          foto_url: b.foto_url || "",
                          preco_custo: b.preco_custo || "",
                          preco_venda: b.preco_venda || "",
                          preco_desconto: b.preco_desconto || "",
                          desconto_ativo: b.desconto_ativo || false,
                          quantidade: b.quantidade || 0,
                          quantidade_minima: b.quantidade_minima || 2
                        });
                        document.getElementById("prod-code")?.focus();
                      }}
                      className="btn btn-secondary py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold shadow-md hover:shadow-lg transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Editar
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CLIENT PURCHASE & EXCHANGE HISTORY MODAL OVERLAY (Premium) ── */}
      <AnimatePresence>
        {selectedClienteForHistory && (() => {
          const clientSales = vendas.filter(v => v.cliente_id === selectedClienteForHistory.id);
          const clientExchanges = trocas.filter(t => t.cliente_id === selectedClienteForHistory.id);
          const totalSpent = clientSales.reduce((acc, v) => acc + Number(v.preco_vendido), 0);
          
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedClienteForHistory(null)}
                className="absolute inset-0 bg-[#0c0c16]/80 backdrop-blur-md"
              />

              {/* Modal Card */}
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="bg-white border-2 border-[#EACAD6] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[85vh]"
              >
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedClienteForHistory(null)}
                  className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white hover:bg-[#29141B]/[0.03] border border-[#EACAD6] flex items-center justify-center text-[#29141B] hover:text-red-500 transition-colors shadow-sm"
                  title="Fechar"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>

                {/* Header Section */}
                <div className="p-6 border-b border-[#EACAD6] flex flex-col gap-1 pr-12 bg-[#FCFAF9]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#29141B] text-2xl font-bold">receipt_long</span>
                    <span className="text-[11px] uppercase font-extrabold text-[#29141B]/80 tracking-widest">Dossiê do Cliente</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-[#29141B] leading-tight mt-1">
                    {selectedClienteForHistory.nome}
                  </h2>
                  <p className="text-xs text-[#29141B]/70 font-mono mt-0.5">
                    {selectedClienteForHistory.cpf ? `CPF: ${selectedClienteForHistory.cpf}` : "Sem CPF cadastrado"} 
                    {selectedClienteForHistory.telefone ? ` • Tel: ${selectedClienteForHistory.telefone}` : ""}
                  </p>
                </div>

                {/* Content Container (Scrollable) */}
                <div className="p-6 overflow-y-auto flex flex-col gap-6 flex-1 min-h-0">
                  
                  {/* Stats Cards (Mini Bento Grid) */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#FCFAF9] border border-[#EACAD6] rounded-2xl p-3.5 flex flex-col justify-between shadow-sm border-l-4 border-l-indigo-500">
                      <span className="text-[9px] uppercase tracking-wider text-[#29141B]/70 font-extrabold">Total Compras</span>
                      <span className="text-xl font-black text-indigo-600 mt-1">{clientSales.length} un.</span>
                    </div>
                    <div className="bg-[#FCFAF9] border border-[#EACAD6] rounded-2xl p-3.5 flex flex-col justify-between shadow-sm border-l-4 border-l-emerald-500">
                      <span className="text-[9px] uppercase tracking-wider text-[#29141B]/70 font-extrabold">Total Investido</span>
                      <span className="text-xl font-black text-emerald-700 mt-1">R$ {totalSpent.toFixed(2)}</span>
                    </div>
                    <div className="bg-[#FCFAF9] border border-[#EACAD6] rounded-2xl p-3.5 flex flex-col justify-between shadow-sm border-l-4 border-l-amber-500">
                      <span className="text-[9px] uppercase tracking-wider text-[#29141B]/70 font-extrabold">Trocas Efetuadas</span>
                      <span className="text-xl font-black text-amber-700 mt-1">{clientExchanges.length} un.</span>
                    </div>
                  </div>

                  {/* ── SALES HISTORY ── */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#29141B] flex items-center gap-1.5 border-b border-[#EACAD6] pb-2">
                      <span className="material-symbols-outlined text-sm text-indigo-600">shopping_bag</span>
                      Histórico de Compras ({clientSales.length})
                    </h3>
                    
                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {clientSales.map(v => (
                        <div key={v.id} className="bg-[#FCFAF9] border border-[#EACAD6]/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-[#FCFAF9]/80 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                              <span className="material-symbols-outlined text-base">check_circle</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-[#29141B] leading-tight">
                                {v.bolsas?.nome || "Produto Excluído"}
                              </span>
                              <span className="text-[10px] text-[#29141B]/75 mt-0.5">
                                Cód: {v.bolsas?.codigo || "-"} • Atendido por: {v.profiles?.nome || "Sistema"}
                              </span>
                              {v.observacao && (
                                <span className="text-[10px] italic text-[#29141B]/80 mt-1 bg-white p-1.5 rounded border border-[#EACAD6]/40">
                                  Obs: {v.observacao}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end shrink-0 border-t sm:border-t-0 border-[#EACAD6]/30 pt-2 sm:pt-0">
                            <span className="text-sm font-black text-[#29141B]">
                              R$ {Number(v.preco_vendido).toFixed(2)}
                            </span>
                            <span className="text-[9px] text-[#29141B]/60 font-mono mt-0.5">
                              {new Date(v.created_at || v.data).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                            {v.tinha_desconto && (
                              <span className="bg-green-500/10 border border-green-500/30 text-green-600 text-[8px] font-bold px-1.5 py-0.5 rounded mt-1">
                                Desc. R$ {Number(v.desconto_valor).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {clientSales.length === 0 && (
                        <div className="text-center text-[#29141B]/60 text-[11px] py-6 bg-[#FCFAF9] rounded-xl border border-dashed border-[#EACAD6]">
                          Nenhuma compra registrada para este cliente.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── EXCHANGE HISTORY ── */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#29141B] flex items-center gap-1.5 border-b border-[#EACAD6] pb-2">
                      <span className="material-symbols-outlined text-sm text-amber-700">swap_horiz</span>
                      Histórico de Trocas ({clientExchanges.length})
                    </h3>
                    
                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {clientExchanges.map(t => (
                        <div key={t.id} className="bg-[#FCFAF9] border border-[#EACAD6]/60 rounded-xl p-3.5 flex flex-col gap-2.5 hover:bg-[#FCFAF9]/80 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-600 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                Troca {t.status || "pendente"}
                              </span>
                              <span className="text-[10px] text-[#29141B]/70 font-mono">
                                {new Date(t.created_at || t.data).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-[#29141B]">
                              {Number(t.diferenca_valor) > 0 ? (
                                <span>Diferença a Pagar: <span className="text-green-600 font-bold">R$ {Number(t.diferenca_valor).toFixed(2)}</span></span>
                              ) : Number(t.diferenca_valor) < 0 ? (
                                <span>Crédito Cliente: <span className="text-amber-600 font-bold">R$ {Math.abs(Number(t.diferenca_valor)).toFixed(2)}</span></span>
                              ) : (
                                <span>Diferença: <span className="text-[#29141B]/60 font-normal">R$ 0.00</span></span>
                              )}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-b border-[#EACAD6]/40 py-2 bg-white px-2 rounded-lg">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] uppercase tracking-wider text-rose-700 font-extrabold flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">arrow_downward</span> Devolvido
                              </span>
                              <span className="font-bold text-[#29141B] line-clamp-1">{t.devolvida?.nome || "Produto Excluído"}</span>
                              <span className="text-[9px] text-[#29141B]/70">Cód: {t.devolvida?.codigo || "-"}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 border-t sm:border-t-0 sm:border-l border-[#EACAD6]/30 pt-2 sm:pt-0 sm:pl-3">
                              <span className="text-[8px] uppercase tracking-wider text-green-600 font-extrabold flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">arrow_upward</span> Entregue
                              </span>
                              <span className="font-bold text-[#29141B] line-clamp-1">{t.nova?.nome || "Produto Excluído"}</span>
                              <span className="text-[9px] text-[#29141B]/70">Cód: {t.nova?.codigo || "-"}</span>
                            </div>
                          </div>

                          {t.motivo && (
                            <p className="text-[10px] text-[#29141B]/80 bg-white p-2 rounded border border-[#EACAD6]/40 italic">
                              Motivo: {t.motivo}
                            </p>
                          )}
                        </div>
                      ))}
                      {clientExchanges.length === 0 && (
                        <div className="text-center text-[#29141B]/60 text-[11px] py-6 bg-[#FCFAF9] rounded-xl border border-dashed border-[#EACAD6]">
                          Nenhuma troca registrada para este cliente.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Footer / Actions */}
                <div className="p-4 border-t border-[#EACAD6] flex items-center justify-end bg-[#FCFAF9] gap-2 shrink-0">
                  <button 
                    onClick={() => setSelectedClienteForHistory(null)}
                    className="bg-white hover:bg-[#29141B]/[0.03] text-[#29141B] border border-[#EACAD6] hover:border-[#29141B]/50 px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ── TOAST NOTIFICATION SYSTEM (Premium) ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[100] bg-[#29141B] text-white border border-[#D12D6C]/30 py-3 px-5 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-[#D12D6C] text-xl font-bold animate-pulse">info</span>
            <span className="text-xs font-bold font-sans tracking-wide">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
