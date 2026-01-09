export const particlesConfig = {
  particles: {
    number: {
      value: 80,
      density: {
        enable: true,
        value_area: 800
      }
    },
    color: {
      value: ['#00C3FF', '#FFB800', '#005A8D']
    },
    shape: {
      type: 'circle',
      stroke: {
        width: 0,
        color: '#000000'
      },
      polygon: {
        nb_sides: 5
      }
    },
    opacity: {
      value: 0.6,
      random: true,
      anim: {
        enable: true,
        speed: 1,
        opacity_min: 0.1,
        sync: false
      }
    },
    size: {
      value: 3,
      random: true,
      anim: {
        enable: true,
        speed: 2,
        size_min: 0.1,
        sync: false
      }
    },
    line_linked: {
      enable: true,
      distance: 150,
      color: '#00C3FF',
      opacity: 0.4,
      width: 1
    },
    move: {
      enable: true,
      speed: 1.5,
      direction: 'none',
      random: true,
      straight: false,
      out_mode: 'out',
      bounce: false,
      attract: {
        enable: true,
        rotateX: 600,
        rotateY: 1200
      }
    }
  },
  interactivity: {
    detect_on: 'canvas',
    events: {
      onhover: {
        enable: true,
        mode: 'grab'
      },
      onclick: {
        enable: true,
        mode: 'push'
      },
      resize: true
    },
    modes: {
      grab: {
        distance: 140,
        line_linked: {
          opacity: 0.8
        }
      },
      bubble: {
        distance: 400,
        size: 40,
        duration: 2,
        opacity: 0.8,
        speed: 3
      },
      repulse: {
        distance: 200,
        duration: 0.4
      },
      push: {
        particles_nb: 4
      },
      remove: {
        particles_nb: 2
      }
    }
  },
  retina_detect: true
};

// Configuración específica para perfil de usuario
export const particlesConfigPerfil = {
  particles: {
    number: {
      value: 70,
      density: {
        enable: true,
        value_area: 900
      }
    },
    color: {
      value: ['#FFD700', '#00FFFF', '#FFA500', '#00BFFF', '#FFFF00']
    },
    shape: {
      type: 'circle',
      stroke: {
        width: 0,
        color: '#000000'
      },
      polygon: {
        nb_sides: 5
      }
    },
    opacity: {
      value: 0.7,
      random: true,
      anim: {
        enable: true,
        speed: 1.5,
        opacity_min: 0.2,
        sync: false
      }
    },
    size: {
      value: 3,
      random: true,
      anim: {
        enable: true,
        speed: 2,
        size_min: 0.1,
        sync: false
      }
    },
    line_linked: {
      enable: true,
      distance: 160,
      color: '#FFD700',
      opacity: 0.5,
      width: 1.5
    },
    move: {
      enable: true,
      speed: 1.8,
      direction: 'none',
      random: true,
      straight: false,
      out_mode: 'out',
      bounce: false,
      attract: {
        enable: true,
        rotateX: 600,
        rotateY: 1200
      }
    }
  },
  interactivity: {
    detect_on: 'canvas',
    events: {
      onhover: {
        enable: true,
        mode: 'grab'
      },
      onclick: {
        enable: true,
        mode: 'push'
      },
      resize: true
    },
    modes: {
      grab: {
        distance: 140,
        line_linked: {
          opacity: 0.8
        }
      },
      bubble: {
        distance: 400,
        size: 40,
        duration: 2,
        opacity: 0.8,
        speed: 3
      },
      repulse: {
        distance: 200,
        duration: 0.4
      },
      push: {
        particles_nb: 4
      },
      remove: {
        particles_nb: 2
      }
    }
  },
  retina_detect: true
}; 