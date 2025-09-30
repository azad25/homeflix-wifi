"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'spark' | 'ember' | 'ice' | 'star' | 'neon' | 'steel' | 'magic';
}

interface ParticleSystemProps {
  genre: string;
  intensity?: 'low' | 'medium' | 'high';
  width: number;
  height: number;
  className?: string;
}

const ParticleSystem: React.FC<ParticleSystemProps> = ({
  genre,
  intensity = 'medium',
  width,
  height,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  const particleConfig = useMemo(() => {
    const configs = {
      action: {
        count: intensity === 'high' ? 150 : intensity === 'medium' ? 100 : 50,
        types: ['spark', 'ember'],
        colors: ['#ff4444', '#ff8800', '#ffaa00', '#ffffff'],
        speed: 2.5,
        gravity: 0.1,
        turbulence: 0.02
      },
      horror: {
        count: intensity === 'high' ? 120 : intensity === 'medium' ? 80 : 40,
        types: ['ember', 'spark'],
        colors: ['#8b0000', '#660000', '#440000', '#220000'],
        speed: 1.5,
        gravity: -0.05,
        turbulence: 0.03
      },
      'sci-fi': {
        count: intensity === 'high' ? 200 : intensity === 'medium' ? 150 : 75,
        types: ['neon', 'star'],
        colors: ['#00ffff', '#0088ff', '#4400ff', '#8800ff'],
        speed: 3.0,
        gravity: 0,
        turbulence: 0.01
      },
      fantasy: {
        count: intensity === 'high' ? 180 : intensity === 'medium' ? 120 : 60,
        types: ['magic', 'star'],
        colors: ['#9933ff', '#ff33aa', '#33ffaa', '#ffaa33'],
        speed: 2.0,
        gravity: -0.02,
        turbulence: 0.04
      },
      comedy: {
        count: intensity === 'high' ? 100 : intensity === 'medium' ? 70 : 35,
        types: ['star', 'spark'],
        colors: ['#ffff00', '#ff8800', '#ff4488', '#88ff44'],
        speed: 2.2,
        gravity: 0.05,
        turbulence: 0.02
      },
      thriller: {
        count: intensity === 'high' ? 90 : intensity === 'medium' ? 60 : 30,
        types: ['steel', 'ember'],
        colors: ['#666666', '#888888', '#444444', '#222222'],
        speed: 1.8,
        gravity: 0.08,
        turbulence: 0.025
      },
      romance: {
        count: intensity === 'high' ? 140 : intensity === 'medium' ? 90 : 45,
        types: ['star', 'magic'],
        colors: ['#ff6699', '#ff99cc', '#ffccdd', '#ffffff'],
        speed: 1.5,
        gravity: -0.01,
        turbulence: 0.015
      },
      documentary: {
        count: intensity === 'high' ? 60 : intensity === 'medium' ? 40 : 20,
        types: ['star'],
        colors: ['#44aa44', '#66cc66', '#88ee88', '#aaffaa'],
        speed: 1.0,
        gravity: 0,
        turbulence: 0.01
      },
      animation: {
        count: intensity === 'high' ? 200 : intensity === 'medium' ? 140 : 70,
        types: ['magic', 'star', 'neon'],
        colors: ['#ff0088', '#8800ff', '#0088ff', '#88ff00'],
        speed: 2.8,
        gravity: 0.02,
        turbulence: 0.03
      },
      crime: {
        count: intensity === 'high' ? 80 : intensity === 'medium' ? 50 : 25,
        types: ['steel', 'ember'],
        colors: ['#333333', '#555555', '#777777', '#999999'],
        speed: 1.6,
        gravity: 0.12,
        turbulence: 0.02
      },
      mystery: {
        count: intensity === 'high' ? 100 : intensity === 'medium' ? 70 : 35,
        types: ['magic', 'ember'],
        colors: ['#4444aa', '#6666cc', '#8888ee', '#aaaaff'],
        speed: 1.4,
        gravity: 0.03,
        turbulence: 0.035
      },
      drama: {
        count: intensity === 'high' ? 80 : intensity === 'medium' ? 55 : 25,
        types: ['star'],
        colors: ['#4488cc', '#6699dd', '#88aaee', '#aabbff'],
        speed: 1.2,
        gravity: 0.01,
        turbulence: 0.01
      }
    };

    const normalizedGenre = genre.toLowerCase().replace(/\s+/g, '-');
    return configs[normalizedGenre as keyof typeof configs] || configs.drama;
  }, [genre, intensity]);

  const createParticle = (x?: number, y?: number): Particle => {
    const config = particleConfig;
    const particleType = config.types[Math.floor(Math.random() * config.types.length)];
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    
    return {
      id: Math.random(),
      x: x ?? Math.random() * width,
      y: y ?? Math.random() * height,
      z: Math.random() * 100,
      vx: (Math.random() - 0.5) * config.speed,
      vy: (Math.random() - 0.5) * config.speed,
      vz: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 4 + 1,
      opacity: Math.random() * 0.8 + 0.2,
      color,
      life: 0,
      maxLife: Math.random() * 200 + 100,
      type: particleType as Particle['type']
    };
  };

  const updateParticle = (particle: Particle): Particle => {
    const config = particleConfig;
    
    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.z += particle.vz;
    
    // Apply gravity and turbulence
    particle.vy += config.gravity;
    particle.vx += (Math.random() - 0.5) * config.turbulence;
    particle.vy += (Math.random() - 0.5) * config.turbulence;
    
    // Mouse interaction
    const dx = mouseRef.current.x - particle.x;
    const dy = mouseRef.current.y - particle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 100) {
      const force = (100 - distance) / 100;
      particle.vx += (dx / distance) * force * 0.1;
      particle.vy += (dy / distance) * force * 0.1;
    }
    
    // Update life
    particle.life++;
    particle.opacity = Math.max(0, 1 - (particle.life / particle.maxLife));
    
    // Wrap around edges
    if (particle.x < 0) particle.x = width;
    if (particle.x > width) particle.x = 0;
    if (particle.y < 0) particle.y = height;
    if (particle.y > height) particle.y = 0;
    
    return particle;
  };

  const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    ctx.save();
    
    const scale = 1 + (particle.z / 100) * 0.5;
    const alpha = particle.opacity * (0.5 + (particle.z / 100) * 0.5);
    
    ctx.globalAlpha = alpha;
    ctx.translate(particle.x, particle.y);
    ctx.scale(scale, scale);
    
    switch (particle.type) {
      case 'spark':
        // Electric spark effect
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = particle.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(-particle.size, 0);
        ctx.lineTo(particle.size, 0);
        ctx.moveTo(0, -particle.size);
        ctx.lineTo(0, particle.size);
        ctx.stroke();
        break;
        
      case 'ember':
        // Glowing ember
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.7, particle.color + '80');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'ice':
        // Crystalline ice particle
        ctx.strokeStyle = particle.color;
        ctx.fillStyle = particle.color + '40';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * particle.size;
          const y = Math.sin(angle) * particle.size;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'star':
        // Twinkling star
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const outerRadius = particle.size;
          const innerRadius = particle.size * 0.4;
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        break;
        
      case 'neon':
        // Neon glow effect
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = particle.size * 2;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(0, 0, particle.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'steel':
        // Metallic particle
        const steelGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
        steelGradient.addColorStop(0, '#ffffff');
        steelGradient.addColorStop(0.3, particle.color);
        steelGradient.addColorStop(1, '#000000');
        ctx.fillStyle = steelGradient;
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'magic':
        // Magical sparkle
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = particle.size;
        ctx.beginPath();
        ctx.arc(0, 0, particle.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Add sparkle rays
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const length = particle.size * 1.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
          ctx.stroke();
        }
        break;
    }
    
    ctx.restore();
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Update and draw particles
    particlesRef.current = particlesRef.current
      .map(updateParticle)
      .filter(particle => particle.life < particle.maxLife);
    
    // Add new particles if needed
    while (particlesRef.current.length < particleConfig.count) {
      particlesRef.current.push(createParticle());
    }
    
    // Draw all particles
    particlesRef.current.forEach(particle => {
      drawParticle(ctx, particle);
    });
    
    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    // Initialize particles
    particlesRef.current = [];
    for (let i = 0; i < particleConfig.count; i++) {
      particlesRef.current.push(createParticle());
    }
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [particleConfig, width, height]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute inset-0 pointer-events-none ${className}`}
      onMouseMove={handleMouseMove}
      style={{ mixBlendMode: 'screen' }}
    />
  );
};

export default ParticleSystem;
