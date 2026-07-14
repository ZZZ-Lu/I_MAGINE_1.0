import React, { useState, useEffect, useRef } from 'react';
import { Play, Sparkles, AlertCircle, RefreshCw, Film, Image as ImageIcon, Music, Download, Clipboard, Check, ChevronRight, History, X, Tag } from 'lucide-react';

interface GenerationHistory {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  name?: string;
}

/* ───────────── 灵儿 · 智能命名引擎 ───────────── */

const SCENE_KEYWORDS: Record<string, string> = {
  cyberpunk: 'cyberpunk', neon: 'neon', sunset: 'sunset', sunrise: 'sunrise',
  beach: 'beach', forest: 'forest', mountain: 'mountain', city: 'city',
  street: 'street', room: 'room', studio: 'studio', park: 'park', ocean: 'ocean',
  space: 'space', galaxy: 'galaxy', desert: 'desert', snow: 'snow', rain: 'rain',
  night: 'night', dawn: 'dawn', dusk: 'dusk', indoor: 'indoor', outdoor: 'outdoor',
  garden: 'garden', castle: 'castle', temple: 'temple', palace: 'palace',
  hospital: 'hospital', school: 'school', office: 'office', kitchen: 'kitchen',
  bedroom: 'bedroom', 'living room': 'living', battlefield: 'battlefield',
  rooftop: 'rooftop', subway: 'subway', train: 'train', airport: 'airport',
  cafe: 'cafe', restaurant: 'restaurant', library: 'library', museum: 'museum',
  bridge: 'bridge', river: 'river', lake: 'lake', waterfall: 'waterfall',
  volcano: 'volcano', canyon: 'canyon', meadow: 'meadow', jungle: 'jungle',
  savanna: 'savanna', tundra: 'tundra', glacier: 'glacier', reef: 'reef',
  'fairytale forest': 'fairytale', enchanted: 'enchanted', dystopian: 'dystopian',
  utopian: 'utopian', medieval: 'medieval', futuristic: 'futuristic',
  vintage: 'vintage', rustic: 'rustic', modern: 'modern', abstract: 'abstract',
  surreal: 'surreal', dreamy: 'dreamy', horror: 'horror', 'noir': 'noir',
  'film noir': 'noir', 'romantic': 'romantic', 'cozy': 'cozy', 'minimalist': 'minimal',
  'clean': 'clean', 'messy': 'messy', 'dark': 'dark', 'bright': 'bright',
  'golden hour': 'golden', 'blue hour': 'blue', 'magic hour': 'magic',
  'overcast': 'overcast', 'foggy': 'foggy', 'misty': 'misty', 'stormy': 'stormy',
  'windy': 'windy', 'sunny': 'sunny', 'cloudy': 'cloudy', 'rainy': 'rainy',
  'snowy': 'snowy', 'icy': 'icy', 'fiery': 'fiery', 'smoky': 'smoky', 'dusty': 'dusty',
};

const SUBJECT_KEYWORDS: Record<string, string> = {
  portrait: 'portrait', woman: 'woman', man: 'man', girl: 'girl', boy: 'boy',
  'young woman': 'young_woman', 'young man': 'young_man', 'old woman': 'elder_woman',
  'old man': 'elder_man', lady: 'lady', gentleman: 'gentleman', character: 'character',
  actor: 'actor', actress: 'actress', model: 'model', warrior: 'warrior',
  knight: 'knight', mage: 'mage', wizard: 'wizard', robot: 'robot', cyborg: 'cyborg',
  android: 'android', alien: 'alien', monster: 'monster', creature: 'creature',
  spirit: 'spirit', ghost: 'ghost', demon: 'demon', angel: 'angel', god: 'god',
  goddess: 'goddess', hero: 'hero', villain: 'villain', ninja: 'ninja', samurai: 'samurai',
  pirate: 'pirate', cowboy: 'cowboy', astronaut: 'astronaut', pilot: 'pilot',
  soldier: 'soldier', general: 'general', king: 'king', queen: 'queen', prince: 'prince',
  princess: 'princess', maid: 'maid', butler: 'butler', chef: 'chef', doctor: 'doctor',
  nurse: 'nurse', teacher: 'teacher', student: 'student', musician: 'musician',
  artist: 'artist', dancer: 'dancer', singer: 'singer', athlete: 'athlete',
  car: 'car', vehicle: 'vehicle', motorcycle: 'motorcycle', bicycle: 'bicycle',
  truck: 'truck', bus: 'bus', train_vehicle: 'train', airplane: 'airplane',
  helicopter: 'helicopter', ship: 'ship', boat: 'boat', submarine: 'submarine',
  animal: 'animal', cat: 'cat', dog: 'dog', bird: 'bird', dragon: 'dragon',
  phoenix: 'phoenix', horse: 'horse', wolf: 'wolf', bear: 'bear', lion: 'lion',
  tiger: 'tiger', elephant: 'elephant', deer: 'deer', rabbit: 'rabbit', fox: 'fox',
  owl: 'owl', eagle: 'eagle', butterfly: 'butterfly', fish: 'fish', shark: 'shark',
  whale: 'whale', turtle: 'turtle', snake: 'snake', building: 'building',
  house: 'house', architecture: 'architecture', tower: 'tower', skyscraper: 'skyscraper',
  cottage: 'cottage', villa: 'villa', cabin: 'cabin', landscape: 'landscape',
  seascape: 'seascape', cityscape: 'cityscape', flower: 'flower', tree: 'tree',
  plant: 'plant', food: 'food', drink: 'drink', dessert: 'dessert', fruit: 'fruit',
  product: 'product', gadget: 'gadget', jewelry: 'jewelry', weapon: 'weapon',
  sword: 'sword', gun: 'gun', shield: 'shield', armor: 'armor', wand: 'wand',
  book: 'book', crystal: 'crystal', artifact: 'artifact', treasure: 'treasure',
  throne: 'throne', mirror: 'mirror', door: 'door', window: 'window', stairs: 'stairs',
  clock: 'clock', fountain: 'fountain', statue: 'statue', monument: 'monument',
};

const ACTION_KEYWORDS: Record<string, string> = {
  smiling: 'smiling', grinning: 'grinning', laughing: 'laughing', giggling: 'giggling',
  running: 'running', sprinting: 'sprinting', jogging: 'jogging', racing: 'racing',
  fighting: 'fighting', battling: 'battling', dueling: 'dueling', boxing: 'boxing',
  dancing: 'dancing', twirling: 'twirling', spinning: 'spinning', leaping: 'leaping',
  sitting: 'sitting', crouching: 'crouching', kneeling: 'kneeling', squatting: 'squatting',
  standing: 'standing', posing: 'posing', striding: 'striding', marching: 'marching',
  walking: 'walking', strolling: 'strolling', wandering: 'wandering', exploring: 'exploring',
  crying: 'crying', weeping: 'weeping', sobbing: 'sobbing', wailing: 'wailing',
  angry: 'angry', furious: 'furious', raging: 'raging', annoyed: 'annoyed', irritated: 'irritated',
  sad: 'sad', melancholic: 'melancholic', gloomy: 'gloomy', depressed: 'depressed',
  happy: 'happy', joyful: 'joyful', cheerful: 'cheerful', delighted: 'delighted', elated: 'elated',
  calm: 'calm', peaceful: 'peaceful', serene: 'serene', tranquil: 'tranquil', relaxed: 'relaxed',
  serious: 'serious', solemn: 'solemn', stern: 'stern', grim: 'grim',
  shocked: 'shocked', surprised: 'surprised', stunned: 'stunned', amazed: 'amazed', astonished: 'astonished',
  thinking: 'thinking', pondering: 'pondering', contemplating: 'contemplating', meditating: 'meditating',
  jumping: 'jumping', hopping: 'hopping', bouncing: 'bouncing', vaulting: 'vaulting',
  flying: 'flying', soaring: 'soaring', gliding: 'gliding', hovering: 'hovering',
  sleeping: 'sleeping', napping: 'napping', dozing: 'dozing', resting: 'resting',
  reading: 'reading', writing: 'writing', drawing: 'drawing', painting: 'painting', sketching: 'sketching',
  eating: 'eating', drinking: 'drinking', cooking: 'cooking', baking: 'baking', grilling: 'grilling',
  working: 'working', building: 'building', crafting: 'crafting', forging: 'forging', repairing: 'repairing',
  playing: 'playing', gaming: 'gaming', performing: 'performing', practicing: 'practicing',
  singing: 'singing', humming: 'humming', chanting: 'chanting', whispering: 'whispering', shouting: 'shouting',
  looking: 'looking', gazing: 'gazing', staring: 'staring', glancing: 'glancing', peeking: 'peeking',
  watching: 'watching', observing: 'observing', monitoring: 'monitoring', guarding: 'guarding', patrolling: 'patrolling',
  waiting: 'waiting', lingering: 'lingering', loitering: 'loitering',
  hugging: 'hugging', embracing: 'embracing', cuddling: 'cuddling', holding: 'holding', grasping: 'grasping',
  kissing: 'kissing', blowing: 'blowing', waving: 'waving', saluting: 'saluting', bowing: 'bowing',
  pointing: 'pointing', indicating: 'indicating', gesturing: 'gesturing', signaling: 'signaling',
  carrying: 'carrying', lifting: 'lifting', dragging: 'dragging', pushing: 'pushing', pulling: 'pulling',
  driving: 'driving', steering: 'steering', riding: 'riding', sailing: 'sailing', rowing: 'rowing',
  swimming: 'swimming', diving: 'diving', surfing: 'surfing', floating: 'floating', drifting: 'drifting',
  climbing: 'climbing', scaling: 'scaling', ascending: 'ascending', descending: 'descending',
  falling: 'falling', tumbling: 'tumbling', collapsing: 'collapsing', crashing: 'crashing', landing: 'landing',
  casting: 'casting', summoning: 'summoning', conjuring: 'conjuring', enchanting: 'enchanting', blessing: 'blessing',
  attacking: 'attacking', defending: 'defending', blocking: 'blocking', dodging: 'dodging', evading: 'evading',
  chasing: 'chasing', pursuing: 'pursuing', hunting: 'hunting', stalking: 'stalking', tracking: 'tracking',
  fleeing: 'fleeing', escaping: 'escaping', hiding: 'hiding', sneaking: 'sneaking', tiptoeing: 'tiptoeing',
  searching: 'searching', seeking: 'seeking', finding: 'finding', discovering: 'discovering', uncovering: 'uncovering',
};

const VIEW_KEYWORDS: Record<string, string> = {
  closeup: 'closeup', 'close-up': 'closeup', 'extreme closeup': 'extreme_closeup',
  portrait: 'portrait', 'medium shot': 'medium', 'medium-shot': 'medium', 'full shot': 'full',
  'wide shot': 'wide', wide: 'wide', 'extreme wide': 'extreme_wide', 'establishing shot': 'establishing',
  aerial: 'aerial', overhead: 'overhead', 'bird\'s eye': 'birds_eye', 'bird eye': 'birds_eye',
  'low-angle': 'low_angle', 'low angle': 'low_angle', 'worm\'s eye': 'worms_eye',
  'side view': 'side', side: 'side', profile: 'profile',
  'back view': 'back', rear: 'back', 'over-the-shoulder': 'over_shoulder', 'over shoulder': 'over_shoulder',
  'front view': 'front', frontal: 'front',
  macro: 'macro', micro: 'micro',
  cinematic: 'cinematic', 'dutch angle': 'dutch', 'tilted': 'tilted', 'canted': 'canted',
  'top-down': 'top_down', 'top down': 'top_down', 'flat lay': 'flat_lay',
  isometric: 'isometric', 'silhouette': 'silhouette', 'panorama': 'panorama', '360': '360',
  fisheye: 'fisheye', 'long shot': 'long', 'long-shot': 'long', 'master shot': 'master',
  'point-of-view': 'pov', 'point of view': 'pov', pov: 'pov', 'first person': 'pov', 'first-person': 'pov',
};

const ASPECT_LABELS: Record<string, string> = {
  '1:1': 'square',
  '16:9': 'landscape',
  '9:16': 'portrait',
  '4:3': 'standard',
  '3:4': 'vertical_std',
  '2:3': 'vertical_narrow',
  '3:2': 'wide_std',
  '4:5': 'vertical_wide',
  '5:4': 'wide_narrow',
  '21:9': 'ultrawide',
};

function sanitizeFilename(part: string): string {
  return part
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 24);
}

function extractKeyword(text: string, dictionary: Record<string, string>): string | null {
  const lower = text.toLowerCase();
  // Prefer longer matches first
  const entries = Object.entries(dictionary).sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, code] of entries) {
    if (lower.includes(phrase)) return code;
  }
  return null;
}

function generateNameByLinger(prompt: string, aspectRatio: string): string {
  const scene = extractKeyword(prompt, SCENE_KEYWORDS) ?? 'scene';
  const subject = extractKeyword(prompt, SUBJECT_KEYWORDS) ?? 'subject';
  const action = extractKeyword(prompt, ACTION_KEYWORDS) ?? 'static';
  const view = extractKeyword(prompt, VIEW_KEYWORDS) ?? 'default';
  const aspect = ASPECT_LABELS[aspectRatio] ?? 'unknown';

  const parts = [
    sanitizeFilename(scene),
    sanitizeFilename(subject),
    sanitizeFilename(action),
    sanitizeFilename(view),
    sanitizeFilename(aspect),
  ];

  return `${parts.join('_')}.png`;
}

function getUniqueName(baseName: string, existingNames: string[]): string {
  if (!existingNames.includes(baseName)) return baseName;
  const ext = baseName.slice(baseName.lastIndexOf('.'));
  const stem = baseName.slice(0, baseName.lastIndexOf('.'));
  let n = 2;
  while (existingNames.includes(`${stem}_v${n}${ext}`)) {
    n++;
  }
  return `${stem}_v${n}${ext}`;
}

/* ─────────────────────────────────────────────── */

export default function Playground({ onBack }: { onBack?: () => void }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('Playground_apiKey') || '');
  const [prompt, setPrompt] = useState(() => localStorage.getItem('Playground_prompt') || 'A stunning cinematic portrait of actress Go YounJung in neon-lit cyberpunk Seoul streets, masterwork, 8k resolution');
  const [model, setModel] = useState(() => localStorage.getItem('Playground_model') || 'gpt-image-2');
  const [quality, setQuality] = useState(() => localStorage.getItem('Playground_quality') || 'auto');
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('Playground_aspectRatio') || '16:9');
  const [resolution, setResolution] = useState(() => localStorage.getItem('Playground_resolution') || '2k');
  const [refImagePreviews, setRefImagePreviews] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('Playground_refImagePreviews');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [lingerEnabled, setLingerEnabled] = useState(() => {
    try { return localStorage.getItem('Playground_linger') !== 'false'; }
    catch { return true; }
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [logs, setLogs] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<GenerationHistory[]>(() => {
    try {
      const saved = localStorage.getItem('Playground_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => { localStorage.setItem('Playground_apiKey', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('Playground_prompt', prompt); }, [prompt]);
  useEffect(() => { localStorage.setItem('Playground_model', model); }, [model]);
  useEffect(() => { localStorage.setItem('Playground_quality', quality); }, [quality]);
  useEffect(() => { localStorage.setItem('Playground_aspectRatio', aspectRatio); }, [aspectRatio]);
  useEffect(() => { localStorage.setItem('Playground_resolution', resolution); }, [resolution]);
  useEffect(() => { localStorage.setItem('Playground_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('Playground_linger', String(lingerEnabled)); }, [lingerEnabled]);

  const processFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files);
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setRefImagePreviews(prev => {
          if (prev.length >= 16) return prev;
          const newPreviews = [...prev, result];
          try {
            localStorage.setItem('Playground_refImagePreviews', JSON.stringify(newPreviews));
          } catch (err) {
            console.warn("Could not save image to localStorage, size might be too large");
          }
          return newPreviews;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRefImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const images = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (images.length > 0) {
        processFiles(images);
      }
    }
  };

  const addImageFromUrl = async (url: string) => {
    if (!url.trim()) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Not an image');
      const file = new File([blob], 'ref_image.png', { type: blob.type });
      processFiles([file]);
      setImageUrl('');
    } catch (err: any) {
      alert('Failed to load image: ' + err.message);
    }
  };

  const PRESET_IMAGES = [
    '/assets/睡衣加发丝光.png',
    '/assets/睡衣金瞳.png',
  ];

  const loadPresetImages = async () => {
    for (const url of PRESET_IMAGES) {
      try {
        await addImageFromUrl(url);
      } catch {
        // ignore individual failures
      }
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const buildHistoryItem = (id: string, url: string, promptText: string): GenerationHistory => {
    const baseName = generateNameByLinger(promptText, aspectRatio);
    const existingNames = history.map(h => h.name).filter(Boolean) as string[];
    const uniqueName = getUniqueName(baseName, existingNames);
    return {
      id,
      url,
      prompt: promptText,
      timestamp: Date.now(),
      name: lingerEnabled ? uniqueName : undefined,
    };
  };

  const executeApiTest = async () => {
    if (!apiKey) {
      alert('Please enter your API Key');
      return;
    }

    setIsGenerating(true);
    setLogs([]);
    setResultImg(null);
    setResultName(null);

    try {
      addLog(`Starting test for ${model}...`);

      const sizeMap: Record<string, string> = {
        "1:1-1k": "1024x1024", "1:1-2k": "2048x2048", "1:1-4k": "2880x2880",
        "16:9-1k": "1280x720", "16:9-2k": "2560x1440", "16:9-4k": "3840x2160",
        "9:16-1k": "720x1280", "9:16-2k": "1440x2560", "9:16-4k": "2160x3840",
        "4:3-1k": "1024x768", "4:3-2k": "2048x1536", "4:3-4k": "2880x2160",
        "3:4-1k": "768x1024", "3:4-2k": "1536x2048", "3:4-4k": "2160x2880",
        "2:3-1k": "683x1024", "2:3-2k": "1365x2048", "2:3-4k": "1920x2880",
        "3:2-1k": "1024x683", "3:2-2k": "2048x1365", "3:2-4k": "2880x1920",
        "4:5-1k": "819x1024", "4:5-2k": "1638x2048", "4:5-4k": "2304x2880",
        "5:4-1k": "1024x819", "5:4-2k": "2048x1638", "5:4-4k": "2880x2304",
        "21:9-1k": "2560x1080", "21:9-2k": "3440x1440", "21:9-4k": "5120x2160"
      };
      const sizeStr = sizeMap[`${aspectRatio}-${resolution}`] || "1024x1024";

      addLog(`Calculated Size: ${sizeStr}`);
      addLog(`Quality: ${quality}`);

      const [wStr, hStr] = sizeStr.split('x');
      const targetW = parseInt(wStr, 10);
      const targetH = parseInt(hStr, 10);

      let imageBlobs: {blob: Blob, name: string}[] = [];

      if (refImagePreviews.length > 0) {
        addLog(`Using ${refImagePreviews.length} uploaded reference image(s)...`);
        for (let i = 0; i < refImagePreviews.length; i++) {
          try {
            const fetchRes = await fetch(refImagePreviews[i]);
            const blob = await fetchRes.blob();
            imageBlobs.push({blob, name: `reference_${i}.png`});
          } catch (e) {
            addLog(`Failed to load reference image ${i}.`);
          }
        }
      }

      if (imageBlobs.length === 0) {
        addLog(`No reference image provided. Generating ${targetW}x${targetH} blank canvas.`);
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if(ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, targetW, targetH);
        }

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error("Failed to create blank image");
        imageBlobs.push({blob, name: 'image_0.png'});
      }

      if (model === 'seedream-4') {
        const seedreamSizeMap: Record<string, string> = {
          '1:1-1k': '1024x1024',
          '1:1-2k': '2048x2048',
          '1:1-4k': '2880x2880',
          '16:9-1k': '1280x720',
          '16:9-2k': '2560x1440',
          '16:9-4k': '3840x2160',
          '9:16-1k': '720x1280',
          '9:16-2k': '1440x2560',
          '9:16-4k': '2160x3840',
          '4:3-1k': '1152x864',
          '4:3-2k': '2048x1536',
          '4:3-4k': '2880x2160',
          '3:4-1k': '864x1152',
          '3:4-2k': '1536x2048',
          '3:4-4k': '2160x2880',
          '2:3-1k': '800x1200',
          '2:3-2k': '1365x2048',
          '2:3-4k': '1920x2880',
          '3:2-1k': '1200x800',
          '3:2-2k': '2048x1365',
          '3:2-4k': '2880x1920',
          '4:5-1k': '960x1200',
          '4:5-2k': '1638x2048',
          '4:5-4k': '2304x2880',
          '5:4-1k': '1200x960',
          '5:4-2k': '2048x1638',
          '5:4-4k': '2880x2304',
          '21:9-1k': '2048x878',
          '21:9-2k': '3440x1440',
          '21:9-4k': '5120x2160',
        };
        const seedreamSize = seedreamSizeMap[`${aspectRatio}-${resolution}`] || '2048x2048';
        const payload: any = {
          model: 'doubao-seedream-4-0-250828',
          prompt: prompt,
          n: 1,
          response_format: 'url',
          size: seedreamSize,
          stream: false,
          watermark: false,
        };

        if (refImagePreviews.length > 0) {
          payload.image = refImagePreviews;
        }

        addLog(`[即梦4] Sending POST /v1/images/generations...`);

        const res = await fetch('/api/t8star/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
        }

        addLog(`Response Status: ${res.status}`);
        addLog(`Response: ${JSON.stringify(data).substring(0, 200)}...`);

        if (!res.ok) {
          throw new Error(`API Error: ${data.message || data.error?.message || res.statusText}`);
        }

        if (data.data && data.data.length > 0 && data.data[0].url) {
          const resUrl = data.data[0].url;
          setResultImg(resUrl);
          addLog(`Final URL: ${resUrl}`);

          if (lingerEnabled) {
            addLog('灵儿 is naming...');
          }
          const item = buildHistoryItem(Date.now().toString(), resUrl, prompt);
          setResultName(item.name ?? null);
          if (item.name) addLog(`灵儿 named: ${item.name}`);
          setHistory(prev => [item, ...prev].slice(0, 50));
        } else {
          throw new Error(`Unexpected Data structure: ${JSON.stringify(data)}`);
        }
      } else if (model.includes('nano-banana')) {
        const payload: any = {
          model: model,
          prompt: prompt,
          response_format: 'url',
          aspect_ratio: aspectRatio
        };

        if (refImagePreviews.length > 0) {
          payload.image = refImagePreviews;
        }

        addLog(`Sending POST /v1/images/generations (JSON)...`);

        const res = await fetch('/api/t8star/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
        }

        addLog(`Response Status: ${res.status}`);
        addLog(`Response: ${JSON.stringify(data).substring(0, 200)}...`);

        if (!res.ok) {
          throw new Error(`API Error: ${data.message || data.error?.message || res.statusText}`);
        }

        if (data.data && data.data.length > 0 && data.data[0].url) {
          const resUrl = data.data[0].url;
          setResultImg(resUrl);
          addLog(`Final URL: ${resUrl}`);

          if (lingerEnabled) {
            addLog('灵儿 is naming...');
          }
          const item = buildHistoryItem(Date.now().toString(), resUrl, prompt);
          setResultName(item.name ?? null);
          if (item.name) addLog(`灵儿 named: ${item.name}`);
          setHistory(prev => [item, ...prev].slice(0, 50));
        } else {
          throw new Error(`Unexpected Data structure: ${JSON.stringify(data)}`);
        }
      } else {
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('model', model);
        formData.append('n', '1');
        formData.append('quality', quality);
        formData.append('size', sizeStr);
        imageBlobs.forEach(item => {
          formData.append('image', item.blob, item.name);
        });

        addLog(`Sending POST /v1/images/edits?async=true...`);

        const res = await fetch('/api/t8star/v1/images/edits?async=true', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          body: formData
        });

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          addLog(`Failed to parse response: ${text.substring(0, 150)}`);
          throw new Error("Invalid JSON response");
        }

        addLog(`Response Status: ${res.status}`);
        addLog(`Response: ${JSON.stringify(data).substring(0, 200)}...`);

        if (!res.ok) {
          throw new Error(`API Error: ${data.message || data.error?.message || res.statusText}`);
        }

        const taskId = data.task_id || data.data;
        if (!taskId) {
          throw new Error('No task ID returned');
        }

        addLog(`Task submitted. ID: ${taskId}`);

        let attempts = 0;
        while (attempts < 60) {
          attempts++;
          await new Promise(r => setTimeout(r, 5000));
          addLog(`Polling status... (Attempt ${attempts})`);

          const statusRes = await fetch(`/api/t8star/v1/images/tasks/${taskId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });

          const statusText = await statusRes.text();
          let statusData;
          try {
            statusData = JSON.parse(statusText);
          } catch(e) {
            addLog("Parsing error in status response");
            continue;
          }

          const inner = statusData.data || {};
          const state = inner.status;
          addLog(`Status: ${state} | Progress: ${inner.progress || '0%'}`);

          if (state === 'SUCCESS') {
            addLog("SUCCESS! Resolving Image...");
            const resData = inner.data?.data?.[0];
            if (resData && resData.url) {
              setResultImg(resData.url);
              addLog(`Final URL: ${resData.url}`);

              if (lingerEnabled) {
                addLog('灵儿 is naming...');
              }
              const item = buildHistoryItem(taskId, resData.url, prompt);
              setResultName(item.name ?? null);
              if (item.name) addLog(`灵儿 named: ${item.name}`);
              setHistory(prev => [item, ...prev].slice(0, 50));
            } else {
               addLog(`Unexpected Data structure: ${JSON.stringify(inner.data).substring(0, 200)}`);
            }
            break;
          } else if (state === 'FAILURE') {
            addLog(`Task failed: ${inner.fail_reason}`);
            break;
          }
        }
      }

    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string, filename?: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'image.png';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <>
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt="Zoomed output"
            className="max-w-full max-h-full object-contain rounded-lg mix-blend-screen"
          />
          <button
            className="absolute top-6 right-6 text-zinc-400 hover:text-white bg-zinc-900/50 p-2 rounded-full transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImage(null);
            }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {onBack && (
        <div className="mb-4 flex items-center space-x-2">
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors"
          >
            ← 返回首页
          </button>
          <span className="text-xs text-zinc-500 font-mono">API Sandbox</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="col-span-1 lg:col-span-5 bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 space-y-6 text-left">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 font-mono">Real API Tester</h3>
          <h2 className="text-lg font-semibold text-zinc-100 mt-1">Zhenzhen Live Test</h2>
        </div>

        <div className="space-y-4 pt-3 border-t border-zinc-950">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 focus:outline-none rounded-lg p-2.5 text-xs font-mono text-zinc-300"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Prompt (STRING)</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-lg p-3 text-xs font-mono text-zinc-300"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Reference Images (Optional, up to 16)</span>

            <div className="flex gap-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-lg p-2 text-[10px] font-mono text-zinc-300"
              />
              <button
                onClick={() => addImageFromUrl(imageUrl)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-mono text-zinc-300 transition-colors"
              >
                Add
              </button>
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={loadPresetImages}
                className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-600/30 rounded-lg text-[10px] font-mono text-violet-300 transition-colors"
              >
                Load Presets
              </button>
              <span className="text-[9px] font-mono text-zinc-600">or paste a URL above</span>
            </div>

            {refImagePreviews.length > 0 ? (
              <div className="flex flex-wrap gap-3 mt-2">
                {refImagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative inline-block">
                    <img
                      src={preview}
                      alt={`Reference ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-zinc-800 cursor-pointer"
                      onClick={() => setZoomedImage(preview)}
                    />
                    <button
                      onClick={() => {
                        setRefImagePreviews(prev => {
                          const newPreviews = prev.filter((_, i) => i !== idx);
                          if (newPreviews.length > 0) {
                            localStorage.setItem('Playground_refImagePreviews', JSON.stringify(newPreviews));
                          } else {
                            localStorage.removeItem('Playground_refImagePreviews');
                          }
                          return newPreviews;
                        });
                      }}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-500 z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {refImagePreviews.length < 16 && (
                  <div
                    className={`flex items-center justify-center w-20 h-20 border-2 border-dashed rounded-lg transition-colors cursor-pointer relative overflow-hidden ${
                      isDragging ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-800 hover:border-violet-500/50'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center justify-center text-zinc-500 pointer-events-none">
                      <ImageIcon className={`w-5 h-5 mb-1 ${isDragging ? 'text-violet-400' : ''}`} />
                      <span className="text-[10px] font-mono text-center leading-tight">{isDragging ? 'Drop' : 'Add'}</span>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleRefImageChange}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          const images = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                          if (images.length > 0) processFiles(images);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg transition-colors cursor-pointer relative overflow-hidden ${
                  isDragging ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-800 hover:border-violet-500/50'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center text-zinc-500 pointer-events-none">
                  <ImageIcon className={`w-6 h-6 mb-2 ${isDragging ? 'text-violet-400' : ''}`} />
                  <span className="text-xs font-mono">{isDragging ? 'Drop here' : 'Click or Drag Images (Up to 16)'}</span>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleRefImageChange}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const images = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                      if (images.length > 0) processFiles(images);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono">
                <option value="nano-banana-pro">nano-banana-pro</option>
                <option value="nano-banana-hd">nano-banana-hd</option>
                <option value="nano-banana-pro-2k">nano-banana-pro-2k</option>
                <option value="seedream-4">即梦4</option>
                <option value="gpt-image-2">gpt-image-2</option>
                <option value="gpt-image-2-all">gpt-image-2-all</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Quality</span>
              <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono">
                <option value="auto">auto</option>
                <option value="high">high</option>
                <option value="hd">hd</option>
                <option value="standard">standard</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Aspect Ratio</span>
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono">
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
                <option value="2:3">2:3</option>
                <option value="3:2">3:2</option>
                <option value="4:5">4:5</option>
                <option value="5:4">5:4</option>
                <option value="21:9">21:9</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Resolution</span>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono">
                <option value="1k">1k</option>
                <option value="2k">2k</option>
                <option value="4k">4k</option>
              </select>
            </div>
          </div>

          {/* 灵儿开关 */}
          <div className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Tag className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[11px] font-mono text-zinc-300">灵儿 · 智能命名</span>
            </div>
            <button
              onClick={() => setLingerEnabled(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${lingerEnabled ? 'bg-violet-600' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${lingerEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <button
          onClick={executeApiTest}
          disabled={isGenerating}
          className="w-full py-3 px-4 rounded-lg font-mono text-xs font-semibold cursor-pointer text-zinc-100 flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
        >
          {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin text-violet-400" /> : <Sparkles className="h-4 w-4 text-violet-300" />}
          <span>{isGenerating ? 'Testing API...' : 'Run Test'}</span>
        </button>
      </div>

      <div className="col-span-1 lg:col-span-7 space-y-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col" style={{ minHeight: '400px' }}>
          <div className="bg-zinc-900/50 border-b border-zinc-800/80 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`h-2.5 w-2.5 rounded-full ${isGenerating ? 'bg-amber-500 animate-pulse' : 'bg-zinc-700'}`}></div>
              <span className="font-mono text-xs text-zinc-300 font-semibold uppercase">API Terminal</span>
            </div>
            {resultName && (
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono text-violet-400 truncate max-w-[200px]" title={resultName}>{resultName}</span>
                <button
                  onClick={() => handleDownload(resultImg!, resultName)}
                  className="text-zinc-500 hover:text-violet-400 transition-colors"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => copyToClipboard(resultName, 'result-name')}
                  className="text-zinc-500 hover:text-violet-400 transition-colors"
                  title="Copy filename"
                >
                  {copiedId === 'result-name' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          <div className="p-4 font-mono text-[10px] text-zinc-400 bg-zinc-950 space-y-1.5 text-left overflow-y-auto max-h-[300px]">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
                <span className={log.includes('Error') || log.includes('failed') ? 'text-red-400' : log.includes('SUCCESS') ? 'text-green-400' : log.includes('灵儿') ? 'text-violet-400' : ''}>{log}</span>
              </div>
            ))}
            {resultImg && (
              <div className="mt-4 p-2 bg-zinc-900 border border-zinc-800 rounded-lg flex justify-center relative group">
                <img
                  src={resultImg}
                  alt="result"
                  className="max-h-64 object-contain rounded cursor-zoom-in"
                  onClick={() => setZoomedImage(resultImg)}
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1.5">
                  <button
                    onClick={() => handleDownload(resultImg, resultName || 'image.png')}
                    className="bg-zinc-900/80 text-zinc-300 hover:text-white p-1.5 rounded-md border border-zinc-700 backdrop-blur-sm"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Panel */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 text-left">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-zinc-400">
              <History className="w-4 h-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono">Generation History</h3>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                className="text-[10px] font-mono text-zinc-500 hover:text-red-400 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-xs font-mono border border-dashed border-zinc-800 rounded-lg">
              No generations yet. Images will be saved here automatically.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {history.map((item) => (
                <div key={item.id} className="group relative aspect-square bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex-shrink-0 cursor-zoom-in" onClick={() => setZoomedImage(item.url)}>
                  <img src={item.url} alt={item.prompt} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <p className="text-[10px] text-white font-mono line-clamp-2" title={item.prompt}>{item.prompt}</p>
                    {item.name && (
                      <div className="flex items-center space-x-1 mt-1">
                        <Tag className="w-2.5 h-2.5 text-violet-400 flex-shrink-0" />
                        <p className="text-[9px] text-violet-300 font-mono truncate" title={item.name}>{item.name}</p>
                      </div>
                    )}
                    <p className="text-[9px] text-zinc-400 font-mono mt-0.5">{new Date(item.timestamp).toLocaleTimeString()}</p>
                    <div className="flex items-center space-x-2 mt-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item.url, item.name || `image_${item.id}.png`);
                        }}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Download"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(item.name || item.prompt, item.id);
                        }}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Copy filename"
                      >
                        {copiedId === item.id ? <Check className="w-3 h-3 text-green-400" /> : <Clipboard className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
