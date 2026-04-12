"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { getApiUrl } from "@/lib/api";
import { Plus, Trash2, Eye, EyeOff, Settings, RefreshCw, ExternalLink, Edit2, Copy, GripVertical } from "lucide-react";
import WidgetEditor from "@/components/widgets/config/WidgetEditor";
import { useDialog } from "@/components/providers/DialogProvider";
import { Widget } from "@/types/widgets";
import { widgetCache } from "@/utils/widgetCache";

interface PageDef {
  id?: number;
  slug: string;
  title: string;
  description?: string;
  is_default?: boolean;
  is_home_page?: boolean;
  is_nav_visible: boolean;
  nav_order?: number;
}

export default function PageManager() {
  const apiUrl = getApiUrl();
  const dialog = useDialog();
  const [pages, setPages] = useState<PageDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ slug: string; title: string; description: string; is_nav_visible: boolean }>({ slug: "", title: "", description: "", is_nav_visible: true });
  const [error, setError] = useState<string | null>(null);
  const [activePageSlug, setActivePageSlug] = useState<string | null>(null);
  const [blueprintWidgets, setBlueprintWidgets] = useState<Widget[]>([]);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [selectedContent, setSelectedContent] = useState<any[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [reordering, setReordering] = useState(false);
  const latestWidgetsRef = useRef<Widget[]>([]);

  useEffect(() => {
    latestWidgetsRef.current = blueprintWidgets;
  }, [blueprintWidgets]);

  const fetchPages = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/api/pages`);
      const data = res.ok ? await res.json() : [];
      setPages(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Failed to load pages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPages(); }, []);

  const createPage = async () => {
    if (!form.slug.trim() || !form.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiUrl}/api/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ slug: "", title: "", description: "", is_nav_visible: true });
        fetchPages();
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleVisible = async (slug: string, isVisible: boolean) => {
    await fetch(`${apiUrl}/api/pages/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_nav_visible: !isVisible }),
    });
    fetchPages();
  };

  const deletePage = async (slug: string) => {
    const confirmed = await dialog.confirm(
      'Delete Page?',
      `The page "${slug}" and all its widgets will be permanently deleted. This action cannot be undone.`,
      true
    );
    
    if (!confirmed) return;
    
    await fetch(`${apiUrl}/api/pages/${encodeURIComponent(slug)}`, { method: "DELETE" });
    fetchPages();
  };

  const toggleHomePage = async (slug: string, isHomePage: boolean) => {
    await fetch(`${apiUrl}/api/pages/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_home_page: !isHomePage }),
    });
    fetchPages();
  };

  const fetchBlueprint = async (slug: string) => {
    try {
      setBlueprintLoading(true);
      const res = await fetch(`${apiUrl}/api/widgets/page/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        const sorted = Array.isArray(data) ? [...data].sort((a, b) => a.position - b.position) : [];
        setBlueprintWidgets(sorted);
      } else {
        setBlueprintWidgets([]);
      }
    } finally {
      setBlueprintLoading(false);
    }
  };

  useEffect(() => {
    if (!activePageSlug) return;
    fetchBlueprint(activePageSlug);
  }, [activePageSlug]);

  const handleManageWidgets = (slug: string) => {
    setActivePageSlug(slug);
  };

  const closeWidgetManager = () => {
    setActivePageSlug(null);
    setBlueprintWidgets([]);
  };

  const handleReorder = (newOrder: Widget[]) => {
    setBlueprintWidgets(newOrder);
  };

  const saveOrder = async () => {
    // Prevent double clicking / multiple fire
    if (reordering) return;
    setReordering(true);
    
    // Always map the true latest UI ordered arrangement!
    const orderedWidgets = latestWidgetsRef.current;
    
    const updated = orderedWidgets.map((w, index) => ({
      ...w,
      position: index + 1,
    }));
    
    // Optimistic cache update
    setBlueprintWidgets(updated);

    try {
      const payload = {
        widgets: updated.map((w) => ({
          id: w.id,
          position: w.position
        }))
      };

      const response = await fetch(`${apiUrl}/api/widgets/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to reorder');
      widgetCache.invalidate(activePageSlug || 'home');
    } catch (error) {
      setError('Failed to reorder widgets');
      if (activePageSlug) fetchBlueprint(activePageSlug);
    } finally {
      setReordering(false);
    }
  };

  const saveWidget = async (widget: Partial<Widget>) => {
    try {
      const method = widget.id ? 'PUT' : 'POST';
      const url = widget.id ? `${apiUrl}/api/widgets/${widget.id}` : `${apiUrl}/api/widgets`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(widget)
      });

      if (response.ok) {
        if (activePageSlug) {
          await fetchBlueprint(activePageSlug);
        }
        widgetCache.invalidate(activePageSlug || 'home');
        setEditingWidget(null);
      }
    } catch (error) {
      console.error('Error saving widget:', error);
      setError('Failed to save widget');
    }
  };

  const deleteWidget = async (widgetId: number) => {
    const confirmed = await dialog.confirm(
      'Delete Widget?',
      'This widget will be permanently removed from the page. This action cannot be undone.',
      true
    );
    
    if (!confirmed) return;

    try {
      const response = await fetch(`${apiUrl}/api/widgets/${widgetId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        if (activePageSlug) {
          await fetchBlueprint(activePageSlug);
        }
        widgetCache.invalidate(activePageSlug || 'home');
      }
    } catch (error) {
      console.error('Error deleting widget:', error);
      setError('Failed to delete widget');
    }
  };

  const toggleWidgetVisibility = async (widget: Widget) => {
    try {
      const response = await fetch(`${apiUrl}/api/widgets/${widget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...widget, enabled: !widget.enabled })
      });

      if (response.ok) {
        if (activePageSlug) {
          await fetchBlueprint(activePageSlug);
        }
        widgetCache.invalidate(activePageSlug || 'home');
      }
    } catch (error) {
      console.error('Error toggling widget visibility:', error);
      setError('Failed to toggle widget visibility');
    }
  };

  const duplicateWidget = async (widget: Widget) => {
    try {
      const duplicate = {
        ...widget,
        id: undefined,
        name: `${widget.name} (Copy)`,
        position: blueprintWidgets.length + 1
      };
      
      const response = await fetch(`${apiUrl}/api/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicate)
      });

      if (response.ok) {
        if (activePageSlug) {
          await fetchBlueprint(activePageSlug);
        }
        widgetCache.invalidate(activePageSlug || 'home');
      }
    } catch (error) {
      console.error('Error duplicating widget:', error);
      setError('Failed to duplicate widget');
    }
  };

  const createNewWidget = (slug: string) => {
    setActivePageSlug(slug);
    setSelectedContent([]);
    setSelectedGenres([]);
    setEditingWidget({
      id: 0,
      name: "New Widget",
      type: "movie-grid",
      page: slug,
      position: blueprintWidgets.length + 1,
      enabled: true,
      config: "{}",
      contentType: "mixed",
      dataSource: "tmdb",
      maxItems: 10,
      layout: "full",
      colorScheme: "auto",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Pages</h3>
      </div>

      {/* Create form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.replace(/\s+/g, '-').toLowerCase() })}
            placeholder="slug (e.g. discover)"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
          />
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="title"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="description"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-white/80">
              <input type="checkbox" checked={form.is_nav_visible} onChange={(e) => setForm({ ...form, is_nav_visible: e.target.checked })} />
              Show in navbar
            </label>
            <button onClick={createPage} disabled={creating} className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-red-200 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white/5 border border-white/10 rounded-xl">
        {loading ? (
          <div className="p-6 text-white/60">Loading pages...</div>
        ) : pages.length === 0 ? (
          <div className="p-6 text-white/60">No pages yet.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {pages.map((p) => (
              <div key={p.slug} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-white font-medium flex items-center gap-2">
                        {p.title} <span className="text-white/50">/ {p.slug}</span>
                        {p.is_home_page && (
                          <span className="px-2 py-0.5 bg-red-600/20 border border-red-500/30 rounded text-red-200 text-xs font-semibold">
                            HOME PAGE
                          </span>
                        )}
                      </div>
                      {p.description && <div className="text-white/60 text-sm">{p.description}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-white/80 text-sm px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={p.is_home_page || false}
                        onChange={() => toggleHomePage(p.slug, p.is_home_page || false)}
                        className="cursor-pointer"
                      />
                      Set as Home
                    </label>
                    <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-white/10 hover:bg-white/15 rounded-lg border border-white/10 text-white/80 flex items-center gap-1 text-xs">
                      <ExternalLink className="w-4 h-4" /> View
                    </a>
                    <button onClick={() => handleManageWidgets(p.slug)} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 rounded-lg border border-red-500/30 text-red-200 text-sm flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Manage Widgets
                    </button>
                    <button
                      onClick={() => toggleVisible(p.slug, p.is_nav_visible)}
                      className="px-2 py-1 bg-white/10 hover:bg-white/15 rounded-lg border border-white/10"
                      disabled={p.is_home_page}
                      title={p.is_home_page ? "Home page is automatically hidden from nav" : "Toggle navbar visibility"}
                    >
                      {p.is_nav_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deletePage(p.slug)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 rounded-lg border border-red-500/30 text-red-200">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {activePageSlug === p.slug && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-lg border border-red-500/20 bg-red-500/5 p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-red-200 flex items-center gap-2">
                          <Settings className="w-4 h-4" /> Widget Blueprint ({blueprintWidgets.length})
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => createNewWidget(p.slug)}
                            className="text-xs px-2.5 py-1.5 rounded bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-200 flex items-center gap-1"
                            title="Create new widget"
                          >
                            <Plus className="w-4 h-4" />
                            Create Widget
                          </button>
                          <button onClick={() => fetchBlueprint(p.slug)} className="text-xs text-red-200/80 hover:text-red-200 flex items-center gap-1">
                            <RefreshCw className={`w-4 h-4 ${blueprintLoading ? 'animate-spin' : ''}`} /> Refresh
                          </button>
                        </div>
                      </div>
                      {blueprintLoading ? (
                        <div className="text-white/70 text-sm">Loading widgets...</div>
                      ) : blueprintWidgets.length === 0 ? (
                        <div className="text-white/60 text-sm">No widgets configured yet. Use "Manage Widgets" to add one.</div>
                      ) : (
                        <Reorder.Group axis="y" values={blueprintWidgets} onReorder={handleReorder} className="grid grid-cols-1 gap-3">
                          {blueprintWidgets.map((widget) => (
                              <Reorder.Item
                                key={widget.id}
                                value={widget}
                                onDragEnd={() => saveOrder()}
                                className="bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white/80 flex items-center gap-3 transition-colors relative"
                              >
                                <div className="cursor-grab hover:text-white text-white/40 active:cursor-grabbing">
                                  <GripVertical className="w-5 h-5 pointer-events-none" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-white">{widget.name || widget.type}</span>
                                    <span className="text-xs text-white/50">#{widget.position}</span>
                                  </div>
                                <div className="flex flex-wrap gap-2 text-xs text-white/60 mb-3">
                                  <span className="px-2 py-1 bg-white/10 rounded-full">{widget.type}</span>
                                  <span className="px-2 py-1 bg-white/10 rounded-full">layout: {widget.layout}</span>
                                  <span className="px-2 py-1 bg-white/10 rounded-full">data: {widget.contentType || 'mixed'} ({widget.dataSource || 'tmdb'})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleWidgetVisibility(widget)}
                                    title={widget.enabled ? "Hide widget" : "Show widget"}
                                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded transition-colors"
                                  >
                                    {widget.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => duplicateWidget(widget)}
                                    title="Duplicate widget"
                                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded transition-colors"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingWidget(widget);
                                      try {
                                        const config = widget.config ? JSON.parse(widget.config) : {};
                                        setSelectedContent(config.selectedContent || []);
                                        setSelectedGenres(config.selectedGenres || []);
                                      } catch (e) {
                                        setSelectedContent([]);
                                        setSelectedGenres([]);
                                      }
                                    }}
                                    title="Edit widget"
                                    className="p-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-200 hover:text-red-100 rounded transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteWidget(widget.id)}
                                    title="Delete widget"
                                    className="p-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-200 hover:text-red-100 rounded transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                </div>
                              </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Widget Editor Modal */}
      {editingWidget && (
        <WidgetEditor
          widget={editingWidget}
          onSave={saveWidget}
          onCancel={() => setEditingWidget(null)}
          onOpenContentSelector={() => {}}
          selectedContent={selectedContent}
          selectedGenres={selectedGenres}
          selectedLanguages={[]}
          selectedCountries={[]}
          genres={[]}
          onGenreToggle={() => {}}
          onContentToggle={() => {}}
        />
      )}
    </div>
  );
}
