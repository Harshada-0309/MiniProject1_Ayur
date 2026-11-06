import React, { useState, useRef, useEffect } from 'react';
import '../../styles/wellness-theme.css';
import ThemeToggle from '../ui/ThemeToggle';

// SVG Outline Icons for Assessment Workflow (replacing emojis)
function WorkflowIcon({ name, size = 18, className = '' }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `workflow-icon-svg ${className}`.trim(),
    'aria-hidden': 'true',
  };

  switch (name) {
    case 'user-round':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="5" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      );
    case 'ruler':
      return (
        <svg {...props}>
          <path d="M21.3 8.7 8.7 21.3c-.4.4-1 .4-1.4 0l-4.6-4.6c-.4-.4-.4-1 0-1.4L15.3 2.7c.4-.4 1-.4 1.4 0l4.6 4.6c.4.4.4 1 0 1.4Z" />
          <path d="m14.5 5.5-2.5 2.5" />
          <path d="m11.5 8.5-1.5 1.5" />
          <path d="m8.5 11.5-2.5 2.5" />
          <path d="m5.5 14.5-1.5 1.5" />
        </svg>
      );
    case 'target':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'activity':
      return (
        <svg {...props}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case 'salad':
      return (
        <svg {...props}>
          <path d="M7 21h10a4 4 0 0 0 4-4v-1H3v1a4 4 0 0 0 4 4Z" />
          <path d="M11.5 3a5.5 5.5 0 0 0-4.5 8.7V16h10v-4.3A5.5 5.5 0 0 0 12.5 3Z" />
          <path d="M2 11h20" />
        </svg>
      );
    case 'shield-alert':
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      );
    case 'stethoscope':
      return (
        <svg {...props}>
          <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
          <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
          <circle cx="20" cy="10" r="2" />
        </svg>
      );
    case 'sprout':
      return (
        <svg {...props}>
          <path d="M7 20h10" />
          <path d="M10 20c5.5-2.5.8-6.4 3-13" />
          <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4.1 5.5.8Z" />
          <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2Z" />
        </svg>
      );
    case 'test-tube':
      return (
        <svg {...props}>
          <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5c-1.4 0-2.5-1.1-2.5-2.5V2" />
          <path d="M8.5 2h7" />
          <path d="M14.5 16h-5" />
        </svg>
      );
    case 'chart-no-axes-combined':
      return (
        <svg {...props}>
          <path d="M12 16v5" />
          <path d="M16 14v7" />
          <path d="M20 10v11" />
          <path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15" />
          <path d="M4 18v3" />
          <path d="M8 14v7" />
        </svg>
      );
    case 'utensils':
      return (
        <svg {...props}>
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      );
    case 'calendar-days':
      return (
        <svg {...props}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
        </svg>
      );
    default:
      return null;
  }
}

// Food Photography Gallery — Curated Whole Foods & Balanced Nutrition
const GALLERY_ITEMS = [
  {
    id: 1,
    title: 'Nut & Seed Medley',
    tag: 'Whole Almonds & Dried Berries',
    image: '/images/gallery/mixed-nuts-seeds.jpg',
    alt: 'Ceramic bowl filled with whole almonds, pecans, cashews, pumpkin seeds, and dried cranberries',
    objectPosition: 'center',
  },
  {
    id: 2,
    title: 'Morning Breakfast Plate',
    tag: 'Avocado Toast & Fresh Fruit',
    image: '/images/gallery/breakfast-avocado-plate.jpg',
    alt: 'Balanced breakfast plate featuring two avocado toasts with tomato and sprouts, sunny-side eggs, orange slices, kiwi, and blueberries',
    objectPosition: 'center 40%',
  },
  {
    id: 3,
    title: 'Rainbow Salad Bowl',
    tag: 'Fresh Vegetables & Crisp Greens',
    image: '/images/gallery/rainbow-salad-bowl.jpg',
    alt: 'Vibrant salad bowl arranged with shredded purple cabbage, carrots, cherry tomatoes, crisp cucumber slices, and sweet corn',
    objectPosition: 'center',
  },
  {
    id: 4,
    title: 'Heirloom Pulses & Legumes',
    tag: 'Lentils, Beans & Whole Grains',
    image: '/images/gallery/heirloom-pulses-lentils.jpg',
    alt: 'Radial overhead arrangement of assorted colorful dried lentils, split peas, black beans, and chickpeas in paper packets',
    objectPosition: 'center',
  },
  {
    id: 5,
    title: 'Sourdough Avocado Toast',
    tag: 'Rustic Loaf & Microgreens',
    image: '/images/gallery/avocado-sourdough.jpg',
    alt: 'Rustic crusty sourdough slice topped with beautifully fanned ripe avocado and microgreens',
    objectPosition: 'center',
  },
];

// The Real 12-Step Assessment Workflow from AyurDiet Codebase
const WORKFLOW_STAGES = [
  {
    stageId: 'stage-1',
    stageNumber: '01',
    stageName: 'Stage 1 — Understand the Individual',
    stageSubtitle: 'Demographics, anthropometrics, lifestyle, and day-to-day eating habits',
    image: '/images/body-measurements-lifestyle.jpg',
    imageAlt: 'Young woman measuring waist with measuring tape surrounded by fresh colorful fruits and healthy seeds',
    steps: [
      {
        num: '01',
        name: 'Basic Details',
        iconName: 'user-round',
        desc: 'Patient demographics, age, biological sex, consultation date & chief concerns.',
      },
      {
        num: '02',
        name: 'Body Measurements',
        iconName: 'ruler',
        desc: 'Height, weight, BMI calculation, waist-to-hip ratio, and target weight goals.',
      },
      {
        num: '03',
        name: 'Diet Goal',
        iconName: 'target',
        desc: 'Weight management, Doshic rebalancing, metabolic optimization, or therapeutic recovery.',
      },
      {
        num: '04',
        name: 'Lifestyle',
        iconName: 'activity',
        desc: 'Daily physical activity levels, sleep duration, stress factors, and bowel habits.',
      },
      {
        num: '05',
        name: 'Dietary Profile',
        iconName: 'salad',
        desc: 'Dietary preference (Vegetarian, Vegan, Satvik), meal schedule & hydration intake.',
      },
    ],
  },
  {
    stageId: 'stage-2',
    stageNumber: '02',
    stageName: 'Stage 2 — Build a Complete Health Profile',
    stageSubtitle: 'Clinical safety checks, medical history, Ayurvedic constitutional assessment & lab markers',
    image: '/images/ayurvedic-meditation.jpg',
    imageAlt: 'Woman practicing serene yoga meditation on wooden deck in lush green Ayurvedic tropical gardens',
    steps: [
      {
        num: '06',
        name: 'Safety Restrictions',
        iconName: 'shield-alert',
        desc: 'Food allergies (gluten, lactose, nuts) and therapeutic food contraindications.',
      },
      {
        num: '07',
        name: 'Medical Info',
        iconName: 'stethoscope',
        desc: 'Chronic conditions (Diabetes, Hypertension, PCOD), active medications & surgical history.',
      },
      {
        num: '08',
        name: 'Ayurvedic Info',
        iconName: 'sprout',
        desc: 'Prakriti (Dosha constitution), Agni (digestive fire), Koshtha (bowel), and Ama presence.',
      },
      {
        num: '09',
        name: 'Clinical / Lab (Optional)',
        iconName: 'test-tube',
        desc: 'Blood biomarkers, HbA1c, lipid panel, thyroid profiles & vitamin levels.',
      },
    ],
  },
  {
    stageId: 'stage-3',
    stageNumber: '03',
    stageName: 'Stage 3 — Personalize Nutrition',
    stageSubtitle: 'Deterministic nutrition calculations, tailored food choices & Gemini 7-day meal regimen',
    image: '/images/meal-planning-prep.jpg',
    imageAlt: 'Dietitian hand writing clinical meal plan with meal prep containers on table',
    steps: [
      {
        num: '10',
        name: 'Nutrition Targets (Engine)',
        iconName: 'chart-no-axes-combined',
        desc: 'Deterministic BMR, TDEE, calorie targets, macro ratios (protein, carbs, healthy fats).',
      },
      {
        num: '11',
        name: 'Food & Meal Plan',
        iconName: 'utensils',
        desc: 'Curated Ayurvedic recipes, food compatibility rules (Satmya), and therapeutic herbs.',
      },
      {
        num: '12',
        name: '7-Day Diet Plan (Gemini)',
        iconName: 'calendar-days',
        desc: 'AI-augmented, practitioner-verified weekly schedule with Ahara Vidhi Vidhana principles.',
      },
    ],
  },
];

export default function LandingPage({ onNavigateToLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [galleryCenterIndex, setGalleryCenterIndex] = useState(2); // Center card (index 2) by default
  const [activeStageId, setActiveStageId] = useState('stage-1');
  const [workflowInView, setWorkflowInView] = useState(false);
  const touchStartXRef = useRef(null);
  const workflowRef = useRef(null);

  // Trigger entrance animations when workflow section enters viewport
  useEffect(() => {
    const el = workflowRef.current;
    if (!el) return;

    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setWorkflowInView(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      );
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      setWorkflowInView(true);
    }
  }, []);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Stage tab keyboard navigation (Left/Right, Up/Down)
  const handleTabKeyDown = (e, index) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (index + 1) % WORKFLOW_STAGES.length;
      const nextStage = WORKFLOW_STAGES[nextIdx];
      setActiveStageId(nextStage.stageId);
      document.getElementById(`tab-${nextStage.stageId}`)?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (index - 1 + WORKFLOW_STAGES.length) % WORKFLOW_STAGES.length;
      const prevStage = WORKFLOW_STAGES[prevIdx];
      setActiveStageId(prevStage.stageId);
      document.getElementById(`tab-${prevStage.stageId}`)?.focus();
    }
  };

  // Carousel Navigation Handlers
  const handleNextCard = () => {
    setGalleryCenterIndex((prev) => (prev + 1) % GALLERY_ITEMS.length);
  };

  const handlePrevCard = () => {
    setGalleryCenterIndex((prev) => (prev - 1 + GALLERY_ITEMS.length) % GALLERY_ITEMS.length);
  };

  // Touch swipe support for mobile
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (diff > 45) {
      handleNextCard();
    } else if (diff < -45) {
      handlePrevCard();
    }
    touchStartXRef.current = null;
  };

  // Helper to calculate relative positions (-2, -1, 0, 1, 2)
  const getCardPositionClass = (itemIndex) => {
    const total = GALLERY_ITEMS.length;
    let offset = (itemIndex - galleryCenterIndex + total) % total;
    if (offset > total / 2) offset -= total;

    if (offset === 0) return 'pos-center';
    if (offset === -1 || offset === 4) return 'pos-left-1';
    if (offset === 1 || offset === -4) return 'pos-right-1';
    if (offset <= -2) return 'pos-left-2';
    return 'pos-right-2';
  };

  const activeStage = WORKFLOW_STAGES.find((s) => s.stageId === activeStageId) || WORKFLOW_STAGES[0];

  return (
    <div className="wellness-landing-shell">
      {/* --------------------------------------------------------------------
          Section 1: Transparent Navigation Over Hero
          -------------------------------------------------------------------- */}
      <header className="wellness-nav-header">
        <div className="wellness-nav-inner">
          {/* Brand Logo Upper-Left */}
          <div
            className="wellness-brand-link"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            role="button"
            tabIndex={0}
            aria-label="AyurDiet Home"
          >
            <img
              src="/images/ayurdiet-logo-horizontal-light.png"
              alt="AyurDiet — Ayurvedic Nutrition & Dietitian"
              className="wellness-brand-logo"
            />
          </div>

          {/* Desktop Navigation Links & Login CTA */}
          <div className="wellness-nav-right">
            <ul className="wellness-nav-links">
              <li>
                <span
                  className="wellness-nav-link-item"
                  onClick={() => scrollToSection('gallery')}
                >
                  Healthy Gallery
                </span>
              </li>
              <li>
                <span
                  className="wellness-nav-link-item"
                  onClick={() => scrollToSection('workflow')}
                >
                  Clinical Workflow
                </span>
              </li>
              <li>
                <span
                  className="wellness-nav-link-item"
                  onClick={() => scrollToSection('editorial')}
                >
                  Our Approach
                </span>
              </li>
              <li>
                <span
                  className="wellness-nav-link-item"
                  onClick={() => scrollToSection('benefits')}
                >
                  Benefits
                </span>
              </li>
            </ul>

            <ThemeToggle />

            <button
              type="button"
              className="wellness-nav-cta"
              onClick={onNavigateToLogin}
              id="landing-login-btn"
            >
              Dietitian Login
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              className="wellness-mobile-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="wellness-mobile-menu-drawer">
          <div className="wellness-mobile-menu-top">
            <img
              src="/images/ayurdiet-logo-horizontal.png"
              alt="AyurDiet"
              className="wellness-brand-logo"
              style={{ height: '36px' }}
            />
            <button
              type="button"
              className="wellness-mobile-menu-close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
            >
              &times;
            </button>
          </div>
          <ul className="wellness-mobile-menu-list">
            <li>
              <span onClick={() => scrollToSection('gallery')}>Healthy Food Gallery</span>
            </li>
            <li>
              <span onClick={() => scrollToSection('workflow')}>Clinical Assessment Workflow</span>
            </li>
            <li>
              <span onClick={() => scrollToSection('editorial')}>Holistic Nutrition Approach</span>
            </li>
            <li>
              <span onClick={() => scrollToSection('benefits')}>Wellness Benefits</span>
            </li>
            <li style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className="wellness-nav-cta"
                style={{ width: '100%', padding: '0.85rem' }}
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToLogin();
                }}
              >
                Dietitian Login →
              </button>
            </li>
            <li style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
              <ThemeToggle />
            </li>
          </ul>
        </div>
      )}

      {/* --------------------------------------------------------------------
          Section 2: Main Homepage Hero
          -------------------------------------------------------------------- */}
      <section className="wellness-hero-section">
        <div className="wellness-hero-overlay" />

        <div className="wellness-hero-content">
          <div className="wellness-hero-tag">
            <WorkflowIcon name="sprout" size={16} />
            <span>Classical Ayurveda × Modern Clinical Nutrition</span>
          </div>

          <h1 className="wellness-hero-headline">
            Your health journey starts with <span className="accent-italic">understanding</span> your body.
          </h1>

          <p className="wellness-hero-subtitle">
            Discover personalized nutrition through Ayurvedic principles, clinical insights, lifestyle assessment, and thoughtfully planned meals.
          </p>

          <div className="wellness-hero-actions">
            <button
              type="button"
              className="wellness-hero-btn-primary"
              onClick={() => scrollToSection('workflow')}
            >
              <span>Explore Clinical Workflow</span>
              <span>↓</span>
            </button>
            <button
              type="button"
              className="wellness-hero-btn-outline"
              onClick={onNavigateToLogin}
            >
              <span>Dietitian Workspace</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Organic Curved Wave Divider */}
        <div className="wellness-wave-divider" aria-hidden="true">
          <svg viewBox="0 0 1440 90" fill="none" preserveAspectRatio="none">
            <path
              d="M0,38 C260,82 520,18 840,54 C1120,84 1320,32 1440,36 L1440,90 L0,90 Z"
              fill="#162B23"
            />
          </svg>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          Section 3: Healthy Food Image Gallery (Reference Match)
          -------------------------------------------------------------------- */}
      <section className="wellness-gallery-section" id="gallery">
        <div className="wellness-gallery-header">
          <h2 className="wellness-gallery-title">
            Your Healthy Here Starts With Us
          </h2>
          <p className="wellness-gallery-subtitle">
            Having a healthy and fit body can prevent the body from being attacked by disease so that we can continue carrying out daily activities.
          </p>
        </div>

        {/* 5-Card Photographic Gallery Carousel */}
        <div className="wellness-gallery-carousel-wrapper">
          {/* Previous Arrow Button */}
          <button
            type="button"
            className="wellness-gallery-arrow prev"
            onClick={handlePrevCard}
            aria-label="Previous food item"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Cards Row */}
          <div
            className="wellness-gallery-cards-row"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {GALLERY_ITEMS.map((item, index) => {
              const posClass = getCardPositionClass(index);
              return (
                <div
                  key={item.id}
                  className={`wellness-gallery-card ${posClass}`}
                  onClick={() => setGalleryCenterIndex(index)}
                  title={`${item.title} — ${item.tag}`}
                >
                  <img
                    src={item.image}
                    alt={item.alt}
                    loading="lazy"
                    style={{ objectPosition: item.objectPosition || 'center' }}
                  />
                  <div className="wellness-gallery-caption">
                    <span className="wellness-gallery-card-title">{item.title}</span>
                    <span className="wellness-gallery-card-tag">{item.tag}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Next Arrow Button */}
          <button
            type="button"
            className="wellness-gallery-arrow next"
            onClick={handleNextCard}
            aria-label="Next food item"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Pagination Dots */}
        <div className="wellness-gallery-dots" role="tablist" aria-label="Gallery pagination">
          {GALLERY_ITEMS.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`wellness-gallery-dot ${idx === galleryCenterIndex ? 'active' : ''}`}
              onClick={() => setGalleryCenterIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              aria-selected={idx === galleryCenterIndex}
            />
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------------
          Section 4: The Real AyurDiet Assessment Workflow Section
          -------------------------------------------------------------------- */}
      <section
        className={`wellness-workflow-section ${workflowInView ? 'is-in-view' : ''}`}
        id="workflow"
        ref={workflowRef}
      >
        <div className="wellness-workflow-container">
          <div className="wellness-workflow-header">
            <span className="wellness-workflow-eyebrow">
              EVIDENCE-BASED CLINICAL ARCHITECTURE
            </span>
            <h2 className="wellness-workflow-title">
              Your Wellness Journey, Personalized
            </h2>
            <p className="wellness-workflow-subtitle">
              Every person is different. AyurDiet brings together personal measurements, dietary habits, medical context, and Ayurvedic assessment to help dietitians develop individualized nutrition plans.
            </p>
          </div>

          {/* Interactive Stage Tabs */}
          <div className="wellness-stages-tabs" role="tablist" aria-label="Clinical Assessment Stages">
            {WORKFLOW_STAGES.map((stg, idx) => {
              const isActive = activeStageId === stg.stageId;
              return (
                <button
                  key={stg.stageId}
                  id={`tab-${stg.stageId}`}
                  type="button"
                  className={`wellness-stage-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveStageId(stg.stageId)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${stg.stageId}`}
                  tabIndex={0}
                >
                  <span className="stage-num">{stg.stageNumber}</span>
                  <span className="stage-name-text">{stg.stageName.split(' — ')[1]}</span>
                </button>
              );
            })}
          </div>

          {/* Active Stage Visual Spotlight */}
          <div
            className="wellness-stage-spotlight"
            id={`panel-${activeStage.stageId}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeStage.stageId}`}
          >
            <div
              className="wellness-spotlight-content"
              key={`spotlight-content-${activeStage.stageId}`}
            >
              <span className="wellness-spotlight-tag">
                {activeStage.stageName}
              </span>
              <h3 className="wellness-spotlight-title">
                {activeStage.stageSubtitle}
              </h3>
              <p className="wellness-spotlight-desc">
                Clinical practitioners systematically capture and analyze individual parameters to construct a holistic physiological and nutritional blueprint before designing any dietary regimen.
              </p>

              {/* Sub-steps in this stage */}
              <div className="wellness-spotlight-rows">
                {activeStage.steps.map((st, idx) => (
                  <div
                    key={st.num}
                    className="wellness-spotlight-row"
                    style={{ animationDelay: `${0.12 + idx * 0.06}s` }}
                  >
                    <div className="wellness-spotlight-row-icon">
                      <WorkflowIcon name={st.iconName} size={18} />
                    </div>
                    <div className="wellness-spotlight-row-text">
                      <span className="wellness-spotlight-row-name">
                        {st.name}
                      </span>
                      <span className="wellness-spotlight-row-desc">
                        — {st.desc.split('.')[0]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="wellness-spotlight-image-box"
              key={`spotlight-img-${activeStage.stageId}`}
            >
              <img
                src={activeStage.image}
                alt={activeStage.imageAlt}
                loading="lazy"
              />
            </div>
          </div>

          {/* Full 12-Step Overview Grid */}
          <h3 className="wellness-steps-grid-title">
            Complete 12-Step Clinical Assessment Workflow
          </h3>

          <div className="wellness-steps-grid">
            {WORKFLOW_STAGES.flatMap((s) => s.steps).map((step) => (
              <div key={step.num} className="wellness-step-card">
                <div className="wellness-step-header">
                  <span className="wellness-step-badge">{step.num}</span>
                  <div className="wellness-step-icon-box">
                    <WorkflowIcon name={step.iconName} size={20} />
                  </div>
                </div>
                <h4 className="wellness-step-name">{step.name}</h4>
                <p className="wellness-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="wellness-workflow-action-box">
            <button
              type="button"
              className="wellness-hero-btn-primary"
              onClick={() => scrollToSection('editorial')}
            >
              <span>Discover the AyurDiet Approach</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          Section 5: Cream-Colored Editorial Section
          -------------------------------------------------------------------- */}
      <section className="wellness-editorial-section" id="editorial">
        <div className="wellness-editorial-container">
          {/* Left Column: Large Clinical Consultation Image */}
          <div className="wellness-editorial-image-wrapper">
            <img
              src="/images/clinical-consultation.jpg"
              alt="Ayurvedic clinical doctor and dietitian counseling a patient on food pyramid and nutrition herbs"
              className="wellness-editorial-image"
              loading="lazy"
            />
          </div>

          {/* Right Column: Editorial Copy */}
          <div className="wellness-editorial-content">
            <span className="wellness-editorial-eyebrow">
              NUTRITION WITHOUT COMPROMISE
            </span>

            <h2 className="wellness-editorial-heading">
              Nutrition that looks at the whole picture.
            </h2>

            <p className="wellness-editorial-desc">
              From everyday food habits and lifestyle patterns to medical context and Ayurvedic assessment, AyurDiet helps dietitians consider the factors that matter when developing personalized nutrition plans.
            </p>

            <div className="wellness-editorial-pillars">
              <div className="wellness-pillar-item">
                <div className="wellness-pillar-icon">✓</div>
                <div className="wellness-pillar-text">
                  <strong>Integrated Doshic & Metabolic Evaluation</strong>
                  <span>Balancing individual Prakriti, Agni (digestive fire), and Ama with evidence-based macro targets.</span>
                </div>
              </div>

              <div className="wellness-pillar-item">
                <div className="wellness-pillar-icon">✓</div>
                <div className="wellness-pillar-text">
                  <strong>Safety-First Clinical Contraindications</strong>
                  <span>Automatic screening for food allergens, cross-sensitivities, chronic conditions, and drug-food interactions.</span>
                </div>
              </div>

              <div className="wellness-pillar-item">
                <div className="wellness-pillar-icon">✓</div>
                <div className="wellness-pillar-text">
                  <strong>Deterministic & AI-Augmented Planning</strong>
                  <span>Seamless transition from calculated targets into 7-day Ahara Vidhi Vidhana schedules backed by Gemini.</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="wellness-hero-btn-primary"
              onClick={onNavigateToLogin}
            >
              <span>Access Dietitian Workspace</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          Section 6: Deep-Green Benefits Section
          -------------------------------------------------------------------- */}
      <section className="wellness-benefits-section" id="benefits">
        <div className="wellness-benefits-header">
          <h2 className="wellness-benefits-title">
            More than a meal plan. <span className="accent-italic">A thoughtful approach to wellness.</span>
          </h2>
        </div>

        {/* 3 Benefit Columns */}
        <div className="wellness-benefits-grid">
          {/* Column 1 */}
          <div className="wellness-benefit-col">
            <div className="wellness-benefit-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="34" height="34" fill="currentColor">
                <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="4" />
                <path d="M16 24L22 30L32 18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="wellness-benefit-title">Personalized Nutrition</h3>
            <p className="wellness-benefit-desc">
              Bring individual goals, food preferences, and relevant health context into the nutrition-planning process.
            </p>
          </div>

          {/* Column 2 */}
          <div className="wellness-benefit-col">
            <div className="wellness-benefit-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="34" height="34" fill="currentColor">
                <rect x="21" y="2" width="6" height="44" rx="3" />
                <rect x="21" y="2" width="6" height="44" rx="3" transform="rotate(45 24 24)" />
                <rect x="21" y="2" width="6" height="44" rx="3" transform="rotate(90 24 24)" />
                <rect x="21" y="2" width="6" height="44" rx="3" transform="rotate(135 24 24)" />
              </svg>
            </div>
            <h3 className="wellness-benefit-title">Ayurvedic Perspective</h3>
            <p className="wellness-benefit-desc">
              Support dietitians in considering Ayurvedic concepts such as Prakriti, Agni, Koshtha, and Ama when these are part of their assessment.
            </p>
          </div>

          {/* Column 3 */}
          <div className="wellness-benefit-col">
            <div className="wellness-benefit-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="34" height="34" fill="currentColor">
                <rect x="8" y="10" width="32" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                <line x1="8" y1="18" x2="40" y2="18" stroke="currentColor" strokeWidth="3" />
                <circle cx="16" cy="26" r="2" />
                <circle cx="24" cy="26" r="2" />
                <circle cx="32" cy="26" r="2" />
              </svg>
            </div>
            <h3 className="wellness-benefit-title">Structured Meal Planning</h3>
            <p className="wellness-benefit-desc">
              Present nutrition targets, food selections, and personalized meal plans through the existing application workflow.
            </p>
          </div>
        </div>

        {/* Responsible Medical Disclaimer */}
        <div className="wellness-disclaimer-box">
          <p style={{ margin: 0 }}>
            <strong>Clinical Disclaimer:</strong> AyurDiet is a clinical decision-support and dietary management platform designed for qualified practitioners and nutritionists. It does not replace qualified clinical judgment, provide autonomous medical diagnosis, or guarantee specific health outcomes.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          Section 7: Integrated Minimal Footer
          -------------------------------------------------------------------- */}
      <footer className="wellness-footer">
        <div className="wellness-footer-inner">
          <div
            className="wellness-footer-brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ cursor: 'pointer' }}
          >
            <img
              src="/images/ayurdiet-logo-horizontal-light.png"
              alt="AyurDiet — Ayurvedic Nutrition & Dietitian"
              className="wellness-footer-logo"
            />
          </div>

          <ul className="wellness-footer-links">
            <li>
              <span onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Back to Top
              </span>
            </li>
            <li>
              <span onClick={() => scrollToSection('gallery')}>
                Healthy Food Gallery
              </span>
            </li>
            <li>
              <span onClick={() => scrollToSection('workflow')}>
                12-Step Workflow
              </span>
            </li>
            <li>
              <span onClick={() => scrollToSection('editorial')}>
                Our Approach
              </span>
            </li>
            <li>
              <span onClick={onNavigateToLogin}>
                Dietitian Login
              </span>
            </li>
          </ul>

          <div>
            &copy; {new Date().getFullYear()} AyurDiet. Designed for modern Ayurvedic clinical practice.
          </div>
        </div>
      </footer>
    </div>
  );
}
