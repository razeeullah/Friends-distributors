import type { PosCustomer, PosProduct, TileCategory } from "@/features/point-of-sale/types";

export const POS_CATEGORIES: readonly TileCategory[] = [
  "All Products",
  "Wall Tiles",
  "Floor Tiles",
  "Porcelain",
  "Marble",
  "Mosaic",
  "Sanitary",
  "Adhesives",
  "Tools",
];

export const POS_PRODUCTS: readonly PosProduct[] = [
  { id: "marble-white", sku: "MRW-6060", name: "Marble White 600x600", category: "Marble", brand: "Premium Stone", dimensions: "600x600 mm", finish: "Glossy Finish", imageClass: "tile-marble-white", pricePaise: 12050, stockSqFt: 500, status: "IN_STOCK" },
  { id: "wood-brown", sku: "WFB-12060", name: "Wood Finish Brown 1200x600", category: "Floor Tiles", brand: "WoodCraft", dimensions: "1200x600 mm", finish: "Matt Finish", imageClass: "tile-wood-brown", pricePaise: 9875, stockSqFt: 320, status: "IN_STOCK" },
  { id: "outdoor-grey", sku: "OSG-6060", name: "Outdoor Stone Grey 600x600", category: "Floor Tiles", brand: "StoneMax", dimensions: "600x600 mm", finish: "Anti-Skid Finish", imageClass: "tile-stone-grey", pricePaise: 7500, stockSqFt: 450, status: "IN_STOCK" },
  { id: "glossy-beige", sku: "GBE-8080", name: "Glossy Beige 800x800", category: "Porcelain", brand: "Ceramica", dimensions: "800x800 mm", finish: "Glossy Finish", imageClass: "tile-glossy-beige", pricePaise: 6000, stockSqFt: 280, status: "IN_STOCK" },
  { id: "calacatta-white", sku: "CAW-12060", name: "Calacatta White 1200x600", category: "Marble", brand: "Premium Stone", dimensions: "1200x600 mm", finish: "Glossy Finish", imageClass: "tile-calacatta", pricePaise: 14500, stockSqFt: 230, status: "IN_STOCK" },
  { id: "nero-marquina", sku: "NEM-6060", name: "Nero Marquina 600x600", category: "Marble", brand: "Royal Marble", dimensions: "600x600 mm", finish: "Glossy Finish", imageClass: "tile-nero", pricePaise: 11000, stockSqFt: 175, status: "IN_STOCK" },
  { id: "mosaic-mix", sku: "MSM-3030", name: "Mosaic Square Mix", category: "Mosaic", brand: "Mosaic Art", dimensions: "300x300 mm", finish: "Matt Finish", imageClass: "tile-mosaic", pricePaise: 8500, stockSqFt: 350, status: "IN_STOCK" },
  { id: "wood-plank", sku: "WPB-12020", name: "Wooden Plank Beige 1200x200", category: "Floor Tiles", brand: "WoodCraft", dimensions: "1200x200 mm", finish: "Matt Finish", imageClass: "tile-wood-beige", pricePaise: 9500, stockSqFt: 410, status: "IN_STOCK" },
  { id: "subway-white", sku: "SWT-3010", name: "Classic Subway White 300x100", category: "Wall Tiles", brand: "Ceramica", dimensions: "300x100 mm", finish: "Glossy Finish", imageClass: "tile-subway", pricePaise: 5250, stockSqFt: 600, status: "IN_STOCK" },
  { id: "blue-porcelain", sku: "BPR-6060", name: "Ocean Blue Porcelain 600x600", category: "Porcelain", brand: "StoneMax", dimensions: "600x600 mm", finish: "Matt Finish", imageClass: "tile-blue", pricePaise: 8850, stockSqFt: 90, status: "LOW_STOCK" },
  { id: "cement-grey", sku: "CGW-6060", name: "Cement Grey Wall Tile", category: "Wall Tiles", brand: "Mosaic Art", dimensions: "600x600 mm", finish: "Matt Finish", imageClass: "tile-cement", pricePaise: 6800, stockSqFt: 220, status: "IN_STOCK" },
  { id: "ivory-sink", sku: "IVS-5050", name: "Ivory Counter Basin", category: "Sanitary", brand: "Ceramica", dimensions: "500x500 mm", finish: "Glossy Finish", imageClass: "tile-ivory", pricePaise: 12900, stockSqFt: 45, status: "LOW_STOCK" },
];

export const POS_CUSTOMERS: readonly PosCustomer[] = [
  { id: "walk-in", name: "Walk-in Customer", phone: "", type: "WALK_IN" },
  { id: "rk-traders", name: "R.K. Traders", phone: "+92 332 3222222", email: "rk@example.com", address: "Karachi, Pakistan", gstNumber: "NTN-1234567-8", outstandingPaise: 12560000, type: "TRADE" },
  { id: "garg-builders", name: "Garg Builders", phone: "+92 300 1234567", email: "orders@garg.example", type: "TRADE" },
  { id: "om-interiors", name: "OM Interiors", phone: "+92 333 9012121", email: "hello@om.example", type: "RETAIL" },
  { id: "patel-construction", name: "Patel Construction", phone: "+92 301 1111222", type: "TRADE" },
  { id: "shree-balaji", name: "Shree Balaji Enterprises", phone: "+92 311 1101010", type: "TRADE" },
];
