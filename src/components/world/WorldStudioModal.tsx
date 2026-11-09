import { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Users,
  BookOpen,
  GitBranch,
  MapPin,
  Share2,
  Edit2,
  Check,
  Sparkles,
  ArrowRight,
  FileText,
  RefreshCw,
  Save,
  Image as ImageIcon,
  Upload,
  Move,
  Calendar,
} from 'lucide-react';
import { useVaultStore, useWorldGraphStore, useEditorStore } from '../../store';
import { WorldNode, WorldEdge, WorldNodeType } from '../../lib/tauri-commands';

interface WorldStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Predefined palette for plot/foreshadowing nodes
const PLOT_COLOR_PALETTE = [
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
];

export function WorldStudioModal({ isOpen, onClose }: WorldStudioModalProps) {
  const { vaultPath } = useVaultStore();
  const { theme } = useEditorStore();
  const {
    graphData,
    upsertNode,
    deleteNode,
    upsertEdge,
    deleteEdge,
    notes,
    loadNotesList,
    readNoteContent,
    saveNoteContent,
    syncAllNotes,
  } = useWorldGraphStore();

  const isSepia = theme === 'cream-sepia';

  const [activeTab, setActiveTab] = useState<'cards' | 'graph' | 'notes'>('cards');
  const [selectedNote, setSelectedNote] = useState<string>('characters.md');
  const [noteContent, setNoteContent] = useState<string>('');
  const [isSyncingNotes, setIsSyncingNotes] = useState(false);
  const [isNoteSaved, setIsNoteSaved] = useState(false);
  const [newNoteFileName, setNewNoteFileName] = useState('');
  const [isCreatingNewNote, setIsCreatingNewNote] = useState(false);

  useEffect(() => {
    if (vaultPath && isOpen) {
      loadNotesList(vaultPath);
    }
  }, [vaultPath, isOpen, loadNotesList]);

  useEffect(() => {
    if (vaultPath && selectedNote) {
      readNoteContent(vaultPath, selectedNote).then((c) => setNoteContent(c));
    }
  }, [vaultPath, selectedNote, readNoteContent]);

  const [categoryFilter, setCategoryFilter] = useState<WorldNodeType>('character');
  const [editingNode, setEditingNode] = useState<WorldNode | null>(null);
  const [isCreatingNode, setIsCreatingNode] = useState(false);

  // Phase / Timeline state for multi-page graph
  const [activePhase, setActivePhase] = useState<string>('all');
  const [availablePhases, setAvailablePhases] = useState<string[]>(['第1話', '第2話', '第3話', 'クライマックス']);
  const [newPhaseInput, setNewPhaseInput] = useState('');
  const [isAddingPhase, setIsAddingPhase] = useState(false);

  // New Edge form state
  const [isAddingEdge, setIsAddingEdge] = useState(false);
  const [newEdgeSource, setNewEdgeSource] = useState('');
  const [newEdgeTarget, setNewEdgeTarget] = useState('');
  const [newEdgeRelation, setNewEdgeRelation] = useState('関係');
  const [newEdgeDescription, setNewEdgeDescription] = useState('');
  const [newEdgePhase, setNewEdgePhase] = useState('');
  const [newEdgeColor, setNewEdgeColor] = useState('#d97706');

  // Form states for node editing/creation
  const [formData, setFormData] = useState<{
    id: string;
    node_type: WorldNodeType;
    name: string;
    aliases: string;
    summary: string;
    first_person: string;
    second_person: string;
    tone: string;
    image_data: string;
    long_note: string;
    phase_id: string;
    pos_x?: number;
    pos_y?: number;
    extra_attrs: { key: string; val: string }[];
  }>({
    id: '',
    node_type: 'character',
    name: '',
    aliases: '',
    summary: '',
    first_person: '',
    second_person: '',
    tone: '',
    image_data: '',
    long_note: '',
    phase_id: '',
    extra_attrs: [],
  });

  // Local graph positions map for dragging
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; nodeX: number; nodeY: number }>({
    clientX: 0,
    clientY: 0,
    nodeX: 0,
    nodeY: 0,
  });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Initialize node positions based on saved pos_x/pos_y or tiered layout
  useEffect(() => {
    const nodes = graphData.nodes || [];
    const positions: Record<string, { x: number; y: number }> = {};
    const nonLocationNodes: WorldNode[] = [];
    const locationNodes: WorldNode[] = [];

    nodes.forEach((n) => {
      if (n.pos_x != null && n.pos_y != null) {
        positions[n.id] = { x: n.pos_x, y: n.pos_y };
      } else if (n.node_type === 'location') {
        locationNodes.push(n);
      } else {
        nonLocationNodes.push(n);
      }
    });

    // Tier 1: Location nodes in bottom zone (y: 430)
    locationNodes.forEach((n, idx) => {
      const step = 800 / (locationNodes.length + 1);
      positions[n.id] = { x: Math.round(step * (idx + 1)), y: 440 };
    });

    // Tier 2: Non-location nodes in upper circle (centerX: 400, centerY: 190)
    const count = nonLocationNodes.length;
    nonLocationNodes.forEach((n, idx) => {
      const angle = (idx / (count || 1)) * 2 * Math.PI - Math.PI / 2;
      const radius = Math.min(260, 120 + count * 15);
      positions[n.id] = {
        x: Math.round(400 + radius * Math.cos(angle)),
        y: Math.round(190 + (radius * 0.7) * Math.sin(angle)),
      };
    });

    setNodePositions(positions);
  }, [graphData.nodes]);

  // Image Upload handler with Canvas resizing to max 200px
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setFormData((prev) => ({ ...prev, image_data: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const openCreateNode = (type: WorldNodeType = categoryFilter) => {
    setFormData({
      id: '',
      node_type: type,
      name: '',
      aliases: '',
      summary: '',
      first_person: '',
      second_person: '',
      tone: '',
      image_data: '',
      long_note: '',
      phase_id: activePhase !== 'all' ? activePhase : '',
      extra_attrs: [],
    });
    setEditingNode(null);
    setIsCreatingNode(true);
  };

  const openEditNode = (node: WorldNode) => {
    const extra: { key: string; val: string }[] = [];
    let fp = '';
    let sp = '';
    let tone = '';

    Object.entries(node.attributes || {}).forEach(([k, v]) => {
      if (k === '一人称') fp = v;
      else if (k === '二人称') sp = v;
      else if (k === '口調') tone = v;
      else extra.push({ key: k, val: v });
    });

    setFormData({
      id: node.id,
      node_type: (node.node_type as WorldNodeType) || 'character',
      name: node.name,
      aliases: (node.aliases || []).join(', '),
      summary: node.summary || '',
      first_person: fp,
      second_person: sp,
      tone: tone,
      image_data: node.image_data || '',
      long_note: node.long_note || '',
      phase_id: node.phase_id || '',
      pos_x: node.pos_x,
      pos_y: node.pos_y,
      extra_attrs: extra,
    });
    setEditingNode(node);
    setIsCreatingNode(true);
  };

  const handleSaveNode = async () => {
    if (!vaultPath || !formData.name.trim()) return;

    const attributes: Record<string, string> = {};
    if (formData.first_person.trim()) attributes['一人称'] = formData.first_person.trim();
    if (formData.second_person.trim()) attributes['二人称'] = formData.second_person.trim();
    if (formData.tone.trim()) attributes['口調'] = formData.tone.trim();

    formData.extra_attrs.forEach((item) => {
      if (item.key.trim()) attributes[item.key.trim()] = item.val.trim();
    });

    const aliases = formData.aliases
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const node: WorldNode = {
      id: formData.id,
      node_type: formData.node_type,
      name: formData.name.trim(),
      aliases,
      summary: formData.summary.trim(),
      attributes,
      image_data: formData.image_data || undefined,
      long_note: formData.long_note || '',
      phase_id: formData.phase_id || undefined,
      pos_x: formData.pos_x ?? (formData.id ? nodePositions[formData.id]?.x : undefined),
      pos_y: formData.pos_y ?? (formData.id ? nodePositions[formData.id]?.y : undefined),
      created_at: editingNode?.created_at || '',
      updated_at: '',
    };

    await upsertNode(vaultPath, node);
    setIsCreatingNode(false);
    setEditingNode(null);
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!vaultPath) return;
    if (window.confirm('この設定ノードと関連する相関関係を削除してもよろしいですか？')) {
      await deleteNode(vaultPath, nodeId);
      if (editingNode?.id === nodeId) {
        setIsCreatingNode(false);
        setEditingNode(null);
      }
    }
  };

  const handleSaveEdge = async () => {
    if (!vaultPath || !newEdgeSource || !newEdgeTarget || !newEdgeRelation.trim()) return;

    const edge: WorldEdge = {
      id: '',
      source_id: newEdgeSource,
      target_id: newEdgeTarget,
      relation_type: newEdgeRelation.trim(),
      description: newEdgeDescription.trim(),
      phase_id: newEdgePhase || undefined,
      color: newEdgeColor || undefined,
    };

    await upsertEdge(vaultPath, edge);
    setIsAddingEdge(false);
    setNewEdgeSource('');
    setNewEdgeTarget('');
    setNewEdgeRelation('関係');
    setNewEdgeDescription('');
    setNewEdgePhase('');
    setNewEdgeColor('#d97706');
  };

  const handleDeleteEdge = async (edgeId: string) => {
    if (!vaultPath) return;
    await deleteEdge(vaultPath, edgeId);
  };

  // Node Dragging Handlers in SVG Canvas (120fps Pointer Capture)
  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggingNodeId(nodeId);
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const curPos = nodePositions[nodeId] || { x: 400, y: 200 };
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      nodeX: curPos.x,
      nodeY: curPos.y,
    };
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingNodeId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 510 / rect.height;

    const dx = (e.clientX - dragStartRef.current.clientX) * scaleX;
    const dy = (e.clientY - dragStartRef.current.clientY) * scaleY;

    const newX = Math.round(Math.min(Math.max(30, dragStartRef.current.nodeX + dx), 770));
    const newY = Math.round(Math.min(Math.max(30, dragStartRef.current.nodeY + dy), 490));

    setNodePositions((prev) => ({
      ...prev,
      [draggingNodeId]: { x: newX, y: newY },
    }));
  };

  const handleSvgPointerUp = async (e: React.PointerEvent) => {
    if (!draggingNodeId || !vaultPath) {
      setDraggingNodeId(null);
      return;
    }
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const finalPos = nodePositions[draggingNodeId];
    const targetNode = graphData.nodes.find((n) => n.id === draggingNodeId);
    if (finalPos && targetNode) {
      const updated: WorldNode = {
        ...targetNode,
        pos_x: finalPos.x,
        pos_y: finalPos.y,
      };
      await upsertNode(vaultPath, updated);
    }
    setDraggingNodeId(null);
  };

  // Filtered nodes for card view
  const filteredNodes = useMemo(() => {
    return (graphData.nodes || []).filter((n) => n.node_type === categoryFilter);
  }, [graphData.nodes, categoryFilter]);

  // Active / Filtered Edges for phase timeline
  const visibleEdges = useMemo(() => {
    const edges = graphData.edges || [];
    if (activePhase === 'all') return edges;
    return edges.filter((e) => !e.phase_id || e.phase_id === activePhase);
  }, [graphData.edges, activePhase]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-5xl h-[88vh] rounded-2xl shadow-2xl flex flex-col border overflow-hidden transition-colors ${
          isSepia
            ? 'bg-[#fbf9f5] border-amber-900/20 text-[#2a2622]'
            : 'bg-[#1e1d1a] border-[#383531] text-[#e8e4de]'
        }`}
      >
        {/* Studio Modal Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isSepia ? 'bg-[#f5f1e8] border-amber-900/10' : 'bg-[#181816] border-[#2c2a27]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white shadow-sm">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base flex items-center gap-2">
                <span>世界観・プロット設定スタジオ</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  KùzuDB / GraphRAG 基盤
                </span>
              </h2>
              <p className="text-xs opacity-60">
                小説の設定資料・人物相関・プロットをグラフ構造で管理し、AI執筆へ自動注入します。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Switcher: Cards vs Visual Graph */}
            <div
              className={`flex items-center p-0.5 rounded-xl border text-xs font-medium ${
                isSepia ? 'bg-white/80 border-amber-200' : 'bg-[#252421] border-[#383531]'
              }`}
            >
              <button
                onClick={() => setActiveTab('cards')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'cards'
                    ? isSepia
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-600 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                🗂️ 設定カード
              </button>
              <button
                onClick={() => setActiveTab('graph')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'graph'
                    ? isSepia
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-600 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                🌐 インタラクティブ相関図
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'notes'
                    ? isSepia
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-600 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                📝 長文設定ノート
              </button>
            </div>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition-all ${
                isSepia
                  ? 'hover:bg-amber-100 border-amber-200 text-neutral-600'
                  : 'hover:bg-[#2b2a27] border-[#383531] text-neutral-400'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Modal Body */}
        <div className="flex-1 overflow-hidden flex">
          {activeTab === 'cards' ? (
            /* TAB 1: Category Card Management */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Category Selector & Add Button */}
              <div
                className={`px-6 py-3 border-b flex items-center justify-between shrink-0 ${
                  isSepia ? 'bg-amber-50/50 border-amber-900/10' : 'bg-[#1a1917]/50 border-[#2c2a27]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCategoryFilter('character')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      categoryFilter === 'character'
                        ? isSepia
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-600 text-white border-amber-600'
                        : isSepia
                        ? 'bg-white border-amber-200 hover:bg-amber-50'
                        : 'bg-[#252421] border-[#383531] hover:bg-[#2c2b28]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>👤 登場人物 ({graphData.nodes.filter((n) => n.node_type === 'character').length})</span>
                  </button>

                  <button
                    onClick={() => setCategoryFilter('term')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      categoryFilter === 'term'
                        ? isSepia
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-600 text-white border-amber-600'
                        : isSepia
                        ? 'bg-white border-amber-200 hover:bg-amber-50'
                        : 'bg-[#252421] border-[#383531] hover:bg-[#2c2b28]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>🏛️ 世界観・用語 ({graphData.nodes.filter((n) => n.node_type === 'term').length})</span>
                  </button>

                  <button
                    onClick={() => setCategoryFilter('plot')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      categoryFilter === 'plot'
                        ? isSepia
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-600 text-white border-amber-600'
                        : isSepia
                        ? 'bg-white border-amber-200 hover:bg-amber-50'
                        : 'bg-[#252421] border-[#383531] hover:bg-[#2c2b28]'
                    }`}
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>📌 プロット・伏線 ({graphData.nodes.filter((n) => n.node_type === 'plot').length})</span>
                  </button>

                  <button
                    onClick={() => setCategoryFilter('location')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      categoryFilter === 'location'
                        ? isSepia
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-600 text-white border-amber-600'
                        : isSepia
                        ? 'bg-white border-amber-200 hover:bg-amber-50'
                        : 'bg-[#252421] border-[#383531] hover:bg-[#2c2b28]'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>🗺️ 場所 ({graphData.nodes.filter((n) => n.node_type === 'location').length})</span>
                  </button>
                </div>

                <button
                  onClick={() => openCreateNode(categoryFilter)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新規設定カードを作成</span>
                </button>
              </div>

              {/* Cards Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {filteredNodes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                    <p className="text-sm">このカテゴリの設定はまだ登録されていません。</p>
                    <button
                      onClick={() => openCreateNode(categoryFilter)}
                      className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white shadow-xs hover:bg-amber-700 transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>最初の一件を追加する</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredNodes.map((node) => {
                      const relations = (graphData.edges || []).filter(
                        (e) => e.source_id === node.id || e.target_id === node.id
                      );

                      return (
                        <div
                          key={node.id}
                          className={`rounded-2xl p-4 border flex flex-col justify-between transition-all group ${
                            isSepia
                              ? 'bg-white hover:border-amber-400 border-amber-900/10 shadow-xs'
                              : 'bg-[#23221f] hover:border-amber-500/50 border-[#383531] shadow-xs'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {node.image_data ? (
                                  <img
                                    src={node.image_data}
                                    alt={node.name}
                                    className="w-10 h-10 rounded-full object-cover border border-amber-500/30 shrink-0 shadow-xs"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-sm flex items-center justify-center shrink-0 border border-amber-500/20">
                                    {node.node_type === 'character'
                                      ? '👤'
                                      : node.node_type === 'plot'
                                      ? '📌'
                                      : node.node_type === 'location'
                                      ? '🗺️'
                                      : '🏛️'}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h3 className="font-bold text-sm tracking-wide truncate">
                                    {node.name}
                                  </h3>
                                  {node.phase_id && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 font-medium">
                                      {node.phase_id}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                  onClick={() => openEditNode(node)}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    isSepia
                                      ? 'hover:bg-amber-50 border-amber-200 text-neutral-600'
                                      : 'hover:bg-[#2f2e2a] border-[#444] text-neutral-300'
                                  }`}
                                  title="編集"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteNode(node.id)}
                                  className="p-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all"
                                  title="削除"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {node.aliases && node.aliases.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {node.aliases.map((alias, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-medium"
                                  >
                                    {alias}
                                  </span>
                                ))}
                              </div>
                            )}

                            <p className="text-xs opacity-75 line-clamp-3 mb-3 leading-relaxed">
                              {node.summary || '概要設定なし'}
                            </p>

                            {/* Attributes snippet */}
                            {node.attributes && Object.keys(node.attributes).length > 0 && (
                              <div
                                className={`text-[11px] p-2.5 rounded-xl border mb-3 space-y-1 ${
                                  isSepia ? 'bg-amber-50/60 border-amber-200/60' : 'bg-[#1c1b18] border-[#333]'
                                }`}
                              >
                                {Object.entries(node.attributes).map(([k, v]) => (
                                  <div key={k} className="flex items-center justify-between gap-2">
                                    <span className="opacity-50 font-medium">{k}:</span>
                                    <span className="font-semibold truncate max-w-[140px]">{v}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Individual Long Note Snippet */}
                            {node.long_note && node.long_note.trim().length > 0 && (
                              <div
                                className={`text-[10px] p-2 rounded-xl border mb-3 flex items-center justify-between ${
                                  isSepia ? 'bg-amber-100/40 border-amber-200/60' : 'bg-[#181816] border-[#2c2a27]'
                                }`}
                              >
                                <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                                  <FileText className="w-3 h-3" />
                                  詳細長文ノートあり
                                </span>
                                <span className="opacity-60">{node.long_note.length}文字</span>
                              </div>
                            )}
                          </div>

                          {/* Connected Relations count */}
                          <div className="pt-2 border-t border-dashed border-current/10 flex items-center justify-between text-[11px] opacity-60">
                            <span>相関関係: {relations.length}件</span>
                            <button
                              onClick={() => openEditNode(node)}
                              className="hover:underline font-medium text-amber-600 dark:text-amber-400"
                            >
                              詳細を編集 →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'graph' ? (
            /* TAB 2: Interactive Visual Graph */
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Visual Graph Toolbar */}
              <div
                className={`px-6 py-2 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 z-10 ${
                  isSepia ? 'bg-amber-50/70 border-amber-900/10' : 'bg-[#181816]/70 border-[#2c2a27]'
                }`}
              >
                {/* Timeline / Phase Switcher */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-[11px] font-bold opacity-60 mr-1 flex items-center gap-1 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    時系列:
                  </span>

                  <button
                    onClick={() => setActivePhase('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activePhase === 'all'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    全編
                  </button>

                  {availablePhases.map((phase) => (
                    <button
                      key={phase}
                      onClick={() => setActivePhase(phase)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        activePhase === phase
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      {phase}
                    </button>
                  ))}

                  {isAddingPhase ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newPhaseInput}
                        onChange={(e) => setNewPhaseInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPhaseInput.trim()) {
                            if (!availablePhases.includes(newPhaseInput.trim())) {
                              setAvailablePhases([...availablePhases, newPhaseInput.trim()]);
                              setActivePhase(newPhaseInput.trim());
                            }
                            setNewPhaseInput('');
                            setIsAddingPhase(false);
                          }
                        }}
                        placeholder="第4話..."
                        className={`px-2 py-0.5 rounded text-xs border outline-none w-20 ${
                          isSepia ? 'bg-white border-amber-300' : 'bg-[#222] border-neutral-700'
                        }`}
                      />
                      <button
                        onClick={() => {
                          if (newPhaseInput.trim() && !availablePhases.includes(newPhaseInput.trim())) {
                            setAvailablePhases([...availablePhases, newPhaseInput.trim()]);
                            setActivePhase(newPhaseInput.trim());
                          }
                          setNewPhaseInput('');
                          setIsAddingPhase(false);
                        }}
                        className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px] font-bold"
                      >
                        追加
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingPhase(true)}
                      className="px-2 py-1 rounded-lg text-[10px] opacity-60 hover:opacity-100 border border-dashed border-current/20 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>フェーズ</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] opacity-50 flex items-center gap-1 hidden md:flex">
                    <Move className="w-3 h-3" />
                    ノードを掴んでドラッグ移動（座標保存）
                  </span>
                  <button
                    onClick={() => setIsAddingEdge(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>相関・プロット関係を追加</span>
                  </button>
                </div>
              </div>

              {/* SVG Canvas with Location Zone and Draggable Diamond/Circle Nodes */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-3">
                <svg
                  ref={svgRef}
                  viewBox="0 0 800 510"
                  onPointerMove={handleSvgPointerMove}
                  onPointerUp={handleSvgPointerUp}
                  className="w-full h-full max-h-[580px] select-none"
                  style={{ minWidth: '650px', cursor: draggingNodeId ? 'grabbing' : 'default' }}
                >
                  <defs>
                    <marker
                      id="arrowhead-amber"
                      markerWidth="10"
                      markerHeight="7"
                      refX="30"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#d97706" />
                    </marker>
                    <marker
                      id="arrowhead-rose"
                      markerWidth="10"
                      markerHeight="7"
                      refX="30"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#f43f5e" />
                    </marker>
                    <marker
                      id="arrowhead-purple"
                      markerWidth="10"
                      markerHeight="7"
                      refX="30"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
                    </marker>

                    {/* Clip paths for circular node avatars */}
                    {graphData.nodes.map((n) => (
                      <clipPath key={`clip-${n.id}`} id={`clip-${n.id}`}>
                        <circle cx="0" cy="0" r="23" />
                      </clipPath>
                    ))}
                  </defs>

                  {/* Tier 1: Location Stage Zone (Bottom) */}
                  <rect
                    x="20"
                    y="380"
                    width="760"
                    height="115"
                    rx="16"
                    fill={isSepia ? '#fef3c7' : '#1c1a17'}
                    stroke={isSepia ? '#d97706' : '#78350f'}
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    opacity="0.45"
                  />
                  <text
                    x="35"
                    y="402"
                    fontSize="11"
                    fontWeight="bold"
                    fill={isSepia ? '#92400e' : '#f59e0b'}
                    opacity="0.8"
                    className="pointer-events-none"
                  >
                    🗺️ 舞台・場所レイヤー（下層ステージ枠）
                  </text>

                  {/* Edges */}
                  {visibleEdges.map((edge) => {
                    const src = nodePositions[edge.source_id];
                    const tgt = nodePositions[edge.target_id];
                    if (!src || !tgt) return null;

                    const srcNode = graphData.nodes.find((n) => n.id === edge.source_id);
                    const tgtNode = graphData.nodes.find((n) => n.id === edge.target_id);
                    const isForeshadowing =
                      srcNode?.node_type === 'plot' ||
                      tgtNode?.node_type === 'plot' ||
                      edge.relation_type.includes('伏線');

                    const edgeColor = edge.color || (isForeshadowing ? '#f43f5e' : '#d97706');
                    const markerId = isForeshadowing ? 'arrowhead-rose' : 'arrowhead-amber';

                    const midX = (src.x + tgt.x) / 2;
                    const midY = (src.y + tgt.y) / 2;

                    return (
                      <g key={edge.id} className="group cursor-pointer">
                        <line
                          x1={src.x}
                          y1={src.y}
                          x2={tgt.x}
                          y2={tgt.y}
                          stroke={edgeColor}
                          strokeWidth={isForeshadowing ? '2.5' : '2'}
                          strokeDasharray={isForeshadowing ? '5 4' : undefined}
                          opacity={isForeshadowing ? '0.85' : '0.6'}
                          markerEnd={`url(#${markerId})`}
                          className="group-hover:opacity-100 group-hover:stroke-amber-400 transition-all"
                        />
                        <rect
                          x={midX - 38}
                          y={midY - 10}
                          width="76"
                          height="20"
                          rx="6"
                          fill={isSepia ? '#fef9c3' : '#262420'}
                          stroke={edgeColor}
                          strokeWidth="1"
                          opacity="0.95"
                        />
                        <text
                          x={midX}
                          y={midY + 4}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill={isSepia ? '#92400e' : '#fbbf24'}
                        >
                          {edge.relation_type}
                        </text>
                      </g>
                    );
                  })}

                  {/* Nodes */}
                  {graphData.nodes.map((node) => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;

                    const isPlot = node.node_type === 'plot';
                    const isLocation = node.node_type === 'location';
                    const isCharacter = node.node_type === 'character';

                    const nodeColor = isCharacter
                      ? '#d97706'
                      : isPlot
                      ? '#f43f5e'
                      : isLocation
                      ? '#10b981'
                      : '#3b82f6';

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                        onClick={() => openEditNode(node)}
                        className="cursor-grab active:cursor-grabbing group touch-none"
                      >
                        {/* Shape: Diamond for Plot/Foreshadowing, Circle for others */}
                        {isPlot ? (
                          <polygon
                            points="0,-30 30,0 0,30 -30,0"
                            fill={isSepia ? '#fff1f2' : '#241417'}
                            stroke={nodeColor}
                            strokeWidth="3"
                            className="group-hover:scale-110 shadow-md"
                          />
                        ) : (
                          <circle
                            r="26"
                            fill={isSepia ? '#ffffff' : '#23221f'}
                            stroke={nodeColor}
                            strokeWidth="3"
                            className="group-hover:scale-110 shadow-md"
                          />
                        )}

                        {/* Image avatar if present, else icon */}
                        {node.image_data ? (
                          <image
                            href={node.image_data}
                            x="-23"
                            y="-23"
                            width="46"
                            height="46"
                            clipPath={`url(#clip-${node.id})`}
                            className="pointer-events-none"
                          />
                        ) : (
                          <text
                            y="4"
                            textAnchor="middle"
                            fontSize="14"
                            className="pointer-events-none"
                          >
                            {isCharacter
                              ? '👤'
                              : isPlot
                              ? '📌'
                              : isLocation
                              ? '🗺️'
                              : '🏛️'}
                          </text>
                        )}

                        {/* Node Label */}
                        <text
                          y={isPlot ? '-36' : '-32'}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="bold"
                          fill="currentColor"
                          className="group-hover:fill-amber-500 transition-colors pointer-events-none"
                        >
                          {node.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Edge quick table at bottom */}
              <div
                className={`p-3 border-t max-h-32 overflow-y-auto text-xs shrink-0 ${
                  isSepia ? 'bg-[#f5f1e8] border-amber-900/10' : 'bg-[#181816] border-[#2c2a27]'
                }`}
              >
                <div className="flex items-center justify-between mb-1 opacity-70">
                  <span className="font-semibold">
                    登録済み相関関係 ({visibleEdges.length}件 / 全{graphData.edges.length}件):
                  </span>
                  {activePhase !== 'all' && (
                    <span className="text-[10px] text-amber-500 font-bold">
                      「{activePhase}」でフィルタ中
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleEdges.map((e) => {
                    const src = graphData.nodes.find((n) => n.id === e.source_id)?.name || '不明';
                    const tgt = graphData.nodes.find((n) => n.id === e.target_id)?.name || '不明';
                    return (
                      <div
                        key={e.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] ${
                          isSepia ? 'bg-white border-amber-200' : 'bg-[#22211f] border-[#383531]'
                        }`}
                      >
                        <span className="font-semibold">{src}</span>
                        <ArrowRight className="w-3 h-3 text-amber-500" />
                        <span className="font-semibold">{tgt}</span>
                        <span
                          style={{ color: e.color || '#d97706' }}
                          className="px-1.5 py-0.2 rounded bg-amber-500/15 font-bold"
                        >
                          {e.relation_type}
                        </span>
                        {e.phase_id && (
                          <span className="text-[9px] px-1 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300">
                            {e.phase_id}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteEdge(e.id)}
                          className="ml-1 text-red-500 hover:text-red-700"
                          title="削除"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 3: Long-form Setting Notes (.md) */
            <div className="flex-1 flex overflow-hidden">
              {/* Note Files Sidebar */}
              <div
                className={`w-64 border-r flex flex-col ${
                  isSepia ? 'border-amber-900/10 bg-amber-50/40' : 'border-neutral-800 bg-[#161513]/60'
                }`}
              >
                <div className="p-3 border-b border-inherit flex items-center justify-between">
                  <span className="text-xs font-bold opacity-75">設定ノート一覧</span>
                  <button
                    onClick={async () => {
                      if (!vaultPath) return;
                      setIsSyncingNotes(true);
                      await syncAllNotes(vaultPath);
                      setIsSyncingNotes(false);
                    }}
                    disabled={isSyncingNotes}
                    className="p-1 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-neutral-500/10 transition-colors"
                    title="全ノートから世界観グラフを一括再同期"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNotes ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {notes.map((note) => (
                    <button
                      key={note}
                      onClick={() => setSelectedNote(note)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2 transition-all ${
                        selectedNote === note
                          ? isSepia
                            ? 'bg-amber-100 border border-amber-300 text-amber-950 font-bold shadow-2xs'
                            : 'bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold shadow-2xs'
                          : 'opacity-70 hover:opacity-100 hover:bg-neutral-500/10'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 opacity-60 shrink-0" />
                      <span className="truncate">{note}</span>
                    </button>
                  ))}
                </div>

                {/* Add new note button */}
                <div className="p-2 border-t border-inherit">
                  {isCreatingNewNote ? (
                    <div className="space-y-1.5 p-1">
                      <input
                        type="text"
                        placeholder="lore.md"
                        value={newNoteFileName}
                        onChange={(e) => setNewNoteFileName(e.target.value)}
                        className={`w-full px-2 py-1 text-xs rounded border outline-none ${
                          isSepia ? 'bg-white border-amber-300' : 'bg-[#22211f] border-neutral-700'
                        }`}
                      />
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => {
                            setIsCreatingNewNote(false);
                            setNewNoteFileName('');
                          }}
                          className="px-2 py-0.5 text-[10px] opacity-60 hover:opacity-100"
                        >
                          取消
                        </button>
                        <button
                          onClick={async () => {
                            if (!vaultPath || !newNoteFileName.trim()) return;
                            const name = newNoteFileName.endsWith('.md')
                              ? newNoteFileName.trim()
                              : `${newNoteFileName.trim()}.md`;
                            await saveNoteContent(vaultPath, name, `# ${name.replace('.md', '')}\n\n`);
                            setSelectedNote(name);
                            setIsCreatingNewNote(false);
                            setNewNoteFileName('');
                          }}
                          className="px-2 py-0.5 text-[10px] bg-amber-600 text-white rounded font-bold"
                        >
                          作成
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsCreatingNewNote(true)}
                      className={`w-full py-2 px-3 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        isSepia
                          ? 'border-amber-300 hover:bg-amber-100/60 text-amber-900'
                          : 'border-neutral-700 hover:bg-[#252420] text-amber-300'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新規設定ノート</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Note Editor Viewport */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div
                  className={`px-6 py-3 border-b flex items-center justify-between ${
                    isSepia ? 'bg-white/50 border-amber-900/10' : 'bg-white/5 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="text-xs font-bold">.novelstudio/notes/{selectedNote}</div>
                      <div className="text-[10px] opacity-50">
                        マークダウン記述（見出し・属性リスト）から人物・舞台・相関関係を自律同期
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isNoteSaved && (
                      <span className="text-xs text-emerald-500 font-bold flex items-center gap-1 animate-pulse">
                        <Check className="w-3.5 h-3.5" /> グラフに同期しました
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        if (!vaultPath || !selectedNote) return;
                        await saveNoteContent(vaultPath, selectedNote, noteContent);
                        setIsNoteSaved(true);
                        setTimeout(() => setIsNoteSaved(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>保存してグラフ同期</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="マークダウンで設定を記述してください..."
                    className={`w-full h-full p-4 rounded-xl font-mono text-xs leading-relaxed resize-none outline-none border transition-all ${
                      isSepia
                        ? 'bg-white/80 border-amber-900/15 focus:border-amber-600 text-neutral-900'
                        : 'bg-[#151412] border-neutral-800 focus:border-amber-500/80 text-neutral-100'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Node Editor / Creation Drawer Modal */}
        {isCreatingNode && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div
              className={`w-full max-w-lg rounded-2xl shadow-2xl border p-6 flex flex-col gap-4 max-h-[88vh] overflow-y-auto ${
                isSepia ? 'bg-[#fbf9f5] border-amber-900/20 text-[#2a2622]' : 'bg-[#22211f] border-[#383531] text-[#e8e4de]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">
                  {editingNode ? `設定カードの編集: ${editingNode.name}` : '新規設定カードの作成'}
                </h3>
                <button
                  onClick={() => setIsCreatingNode(false)}
                  className="p-1 rounded-lg opacity-60 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Character / Node Avatar Image Upload */}
              <div
                className={`p-3 rounded-xl border flex items-center gap-3.5 ${
                  isSepia ? 'bg-amber-50/60 border-amber-200/80' : 'bg-[#181816] border-[#333]'
                }`}
              >
                {formData.image_data ? (
                  <img
                    src={formData.image_data}
                    alt="Preview"
                    className="w-14 h-14 rounded-full object-cover border-2 border-amber-500 shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-amber-500/15 border-2 border-dashed border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <span className="text-xs font-semibold block">設定ビジュアル・人物アイコン</span>
                  <p className="text-[10px] opacity-60">カード一覧・相関図・右インスペクタに表示されます</p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <label
                      htmlFor="node-img-file-input"
                      className="cursor-pointer px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1 shadow-2xs transition-all"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{formData.image_data ? '画像を変更' : '画像をアップロード'}</span>
                    </label>
                    <input
                      id="node-img-file-input"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    {formData.image_data && (
                      <button
                        onClick={() => setFormData((prev) => ({ ...prev, image_data: '' }))}
                        className="px-2 py-1 rounded-lg text-[10px] text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Type, Name & Phase */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold opacity-70 mb-1 block">カテゴリ</label>
                  <select
                    value={formData.node_type}
                    onChange={(e) => setFormData({ ...formData, node_type: e.target.value as WorldNodeType })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                    }`}
                  >
                    <option value="character">👤 登場人物</option>
                    <option value="term">🏛️ 世界観・用語</option>
                    <option value="plot">📌 プロット・伏線</option>
                    <option value="location">🗺️ 場所</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold opacity-70 mb-1 block">名称（必須）</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例: 下人, 羅生門, 追剥ぎの決断"
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                    }`}
                  />
                </div>
              </div>

              {/* Aliases & Timeline Phase */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold opacity-70 mb-1 block">
                    別名・呼称（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={formData.aliases}
                    onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                    placeholder="例: 男, 若者, 主人公"
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold opacity-70 mb-1 block">
                    時系列フェーズ / 話数
                  </label>
                  <select
                    value={formData.phase_id}
                    onChange={(e) => setFormData({ ...formData, phase_id: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                    }`}
                  >
                    <option value="">全編共通</option>
                    {availablePhases.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="text-xs font-semibold opacity-70 mb-1 block">設定概要・一行要約</label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  rows={2}
                  placeholder="登場人物の動機、世界観ルール、プロットの目的など"
                  className={`w-full px-3 py-2 rounded-xl text-xs border resize-none leading-relaxed ${
                    isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                  }`}
                />
              </div>

              {/* Character Attributes (If Character) */}
              {formData.node_type === 'character' && (
                <div
                  className={`p-3.5 rounded-xl border space-y-2.5 ${
                    isSepia ? 'bg-amber-50/70 border-amber-200' : 'bg-[#1a1917] border-[#333]'
                  }`}
                >
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">
                    🎭 キャラクター口調・一人称設定（AI矛盾検知用）
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] opacity-70 block mb-0.5">一人称</label>
                      <input
                        type="text"
                        value={formData.first_person}
                        onChange={(e) => setFormData({ ...formData, first_person: e.target.value })}
                        placeholder="例: おれ, 私, 僕"
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs border ${
                          isSepia ? 'bg-white border-amber-200' : 'bg-[#22211f] border-[#383531]'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] opacity-70 block mb-0.5">二人称</label>
                      <input
                        type="text"
                        value={formData.second_person}
                        onChange={(e) => setFormData({ ...formData, second_person: e.target.value })}
                        placeholder="例: お前, 貴様, あなた"
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs border ${
                          isSepia ? 'bg-white border-amber-200' : 'bg-[#22211f] border-[#383531]'
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] opacity-70 block mb-0.5">口調・トーン</label>
                    <input
                      type="text"
                      value={formData.tone}
                      onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                      placeholder="例: 荒削りで焦燥感がある、冷徹な敬語"
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs border ${
                        isSepia ? 'bg-white border-amber-200' : 'bg-[#22211f] border-[#383531]'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Individual Long-form Note per Card */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold opacity-70 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                    📝 詳細長文設定ノート（文字数無制限・GraphRAG自動反映）
                  </label>
                  <span className="text-[10px] opacity-50 font-mono">
                    {formData.long_note.length}文字
                  </span>
                </div>
                <textarea
                  value={formData.long_note}
                  onChange={(e) => setFormData({ ...formData, long_note: e.target.value })}
                  rows={5}
                  placeholder="この人物の生い立ち、詳細な過去の経緯、心理描写、外見・衣装の特徴、秘密など何千文字でも自由に書き込めます。AI推敲時のGraphRAGコンテキストにも自動注入されます..."
                  className={`w-full p-2.5 rounded-xl text-xs border font-mono resize-none leading-relaxed ${
                    isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                  }`}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-current/10">
                <button
                  onClick={() => setIsCreatingNode(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                    isSepia ? 'border-amber-200 hover:bg-amber-50' : 'border-[#383531] hover:bg-[#2c2b28]'
                  }`}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveNode}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>設定カードを保存</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Add Edge Modal */}
        {isAddingEdge && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div
              className={`w-full max-w-md rounded-2xl shadow-2xl border p-6 flex flex-col gap-4 ${
                isSepia ? 'bg-[#fbf9f5] border-amber-900/20 text-[#2a2622]' : 'bg-[#22211f] border-[#383531] text-[#e8e4de]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">相関・プロット関係の追加</h3>
                <button onClick={() => setIsAddingEdge(false)} className="opacity-60 hover:opacity-100">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold opacity-70 mb-1 block">起点ノード</label>
                    <select
                      value={newEdgeSource}
                      onChange={(e) => setNewEdgeSource(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border ${
                        isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                      }`}
                    >
                      <option value="">選択</option>
                      {graphData.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} ({n.node_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold opacity-70 mb-1 block">対象ノード</label>
                    <select
                      value={newEdgeTarget}
                      onChange={(e) => setNewEdgeTarget(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border ${
                        isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                      }`}
                    >
                      <option value="">選択</option>
                      {graphData.nodes
                        .filter((n) => n.id !== newEdgeSource)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name} ({n.node_type})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold opacity-70 mb-1 block">
                    関係性ラベル（例: 師弟、対峙・敵対、伏線回収、秘密を握る）
                  </label>
                  <input
                    type="text"
                    value={newEdgeRelation}
                    onChange={(e) => setNewEdgeRelation(e.target.value)}
                    placeholder="例: 対峙・追剥ぎ"
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold opacity-70 mb-1 block">時系列フェーズ</label>
                    <select
                      value={newEdgePhase}
                      onChange={(e) => setNewEdgePhase(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border ${
                        isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                      }`}
                    >
                      <option value="">全編共通</option>
                      {availablePhases.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold opacity-70 mb-1 block">関係線の色</label>
                    <div className="flex items-center gap-1.5 pt-1">
                      {PLOT_COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewEdgeColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            newEdgeColor === c ? 'scale-125 ring-2 ring-white ring-offset-1' : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold opacity-70 mb-1 block">関係の詳細（任意）</label>
                  <input
                    type="text"
                    value={newEdgeDescription}
                    onChange={(e) => setNewEdgeDescription(e.target.value)}
                    placeholder="例: 楼上で出遭い、老婆の論理を利用して着物を奪う"
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      isSepia ? 'bg-white border-amber-200' : 'bg-[#181816] border-[#383531]'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-current/10">
                <button
                  onClick={() => setIsAddingEdge(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                    isSepia ? 'border-amber-200 hover:bg-amber-50' : 'border-[#383531] hover:bg-[#2c2b28]'
                  }`}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveEdge}
                  disabled={!newEdgeSource || !newEdgeTarget}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-xs"
                >
                  関係性を保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
