
import { useState, useEffect, useCallback } from 'react';
import { Project } from '../types';

const API_URL = 'http://localhost:3001/api';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch(`${API_URL}/projects`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        const data = await response.json();
        setProjects(data.sort((a: Project, b: Project) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Failed to load projects from server", error);
      }
    };
    fetchProjects();
  }, []);

  const addProject = useCallback(async (name: string, profilePic: string | null): Promise<Project> => {
    if (!name.trim()) throw new Error("Project name cannot be empty.");
    const now = Date.now();
    const newProjectData = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };

    try {
      const payload = profilePic ? { ...newProjectData, profilePic } : newProjectData;
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to save project');
      const savedProject = await response.json();
      setProjects(prev => [...prev, savedProject].sort((a, b) => a.name.localeCompare(b.name)));
      return savedProject;
    } catch (error) {
      console.error("Failed to save project to server", error);
      throw error;
    }
  }, []);

  const updateProjectProfilePic = useCallback(async (projectId: string, profilePic: string) => {
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePic }),
      });
      if (!response.ok) throw new Error('Failed to update project');
      const updatedProject = await response.json();
      setProjects(prev => prev.map(p => (p.id === projectId ? updatedProject : p)));
    } catch (error) {
      console.error("Failed to update project profile picture", error);
    }
  }, []);

  const updateProject = useCallback(async (projectId: string, updates: { name?: string; profilePic?: string; lastChapterId?: string; lastChapterTitle?: string }) => {
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, updatedAt: Date.now() }),
      });
      if (!response.ok) throw new Error('Failed to update project');
      const updatedProject = await response.json();
      setProjects(prev => prev.map(p => (p.id === projectId ? updatedProject : p)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Failed to update project", error);
      throw error;
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete project');
      setProjects(prev => prev.filter(project => project.id !== id));
    } catch (error) {
      console.error("Failed to delete project from server", error);
    }
  }, []);

  return { projects, addProject, updateProjectProfilePic, updateProject, deleteProject };
};