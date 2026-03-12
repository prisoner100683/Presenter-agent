window.__PRESENTATION_DATA__ = {
  "slides": [
    {
      "slideNumber": 1,
      "title": "Caches Updating",
      "kicker": "DI22004",
      "body": [
        "Computer Systems 2B",
        "DII CSU"
      ],
      "note": "Introduction to cache memory concepts and updating mechanisms.",
      "image": ""
    },
    {
      "slideNumber": 2,
      "title": "Revision: the cache",
      "kicker": "Slide 2",
      "body": [
        "A small but very fast area of memory close to the processor",
        "Multi-level",
        "Functions automatically"
      ],
      "note": "Review of basic cache characteristics and purpose.",
      "image": ""
    },
    {
      "slideNumber": 3,
      "title": "Some issues",
      "kicker": "Slide 3",
      "body": [
        "Usage: the cache must function automatically",
        "CPU performs more reads than writes"
      ],
      "note": "Key operational considerations for cache design.",
      "image": ""
    },
    {
      "slideNumber": 4,
      "title": "Cache Updating",
      "kicker": "Slide 4",
      "body": [
        "Strategies for maintaining cache data consistency"
      ],
      "note": "Introduction to cache update methodologies.",
      "image": ""
    },
    {
      "slideNumber": 5,
      "title": "Cache sizes",
      "kicker": "Slide 5",
      "body": [
        "Note that cache sizes quoted refer only to data capacity",
        "Tags and housekeeping data require additional physical storage",
        "This overhead is not included in typical size specifications"
      ],
      "note": "Clarification on how cache sizes are measured and reported.",
      "image": ""
    },
    {
      "slideNumber": 6,
      "title": "Which way?",
      "kicker": "Slide 6",
      "body": [
        "In a set-associative cache:",
        "The set is determined by the address being accessed (thus fixed)"
      ],
      "note": "Set determination in associative caches.",
      "image": ""
    },
    {
      "slideNumber": 7,
      "title": "Cache update strategies",
      "kicker": "Slide 7",
      "body": [
        "When new data is loaded, cache is usually already full",
        "What do we replace?",
        "Three common strategies:",
        "Least recently used (LRU)",
        "First-in first-out (FIFO)",
        "Random replacement"
      ],
      "note": "Overview of cache replacement algorithms.",
      "image": ""
    },
    {
      "slideNumber": 8,
      "title": "Which way?",
      "kicker": "Slide 8",
      "body": [
        "Replacement is done algorithmically using built-in rules",
        "Cache holds extra housekeeping bits (e.g., LRU bits)",
        "These bits are dynamically updated during operation"
      ],
      "note": "Implementation details of replacement algorithms.",
      "image": ""
    },
    {
      "slideNumber": 9,
      "title": "Cache Coherence",
      "kicker": "Slide 9",
      "body": [
        "Maintaining consistency between cache and main memory",
        "Critical in multi-processor systems"
      ],
      "note": "Introduction to cache coherence problems.",
      "image": ""
    },
    {
      "slideNumber": 10,
      "title": "Multi-level caches",
      "kicker": "Slide 10",
      "body": [
        "Modern processors use hierarchy: L1, L2, L3 caches",
        "Each level has different size and speed characteristics",
        "L1: smallest, fastest, closest to CPU",
        "L2/L3: larger, slower, shared between cores"
      ],
      "note": "Explanation of cache hierarchy in contemporary processors.",
      "image": ""
    },
    {
      "slideNumber": 11,
      "title": "Multi-level caches",
      "kicker": "Slide 11",
      "body": [
        "L4 cache sometimes implemented on separate chip",
        "Shared between multiple CPUs",
        "Acts as large buffer between CPU and main memory"
      ],
      "note": "Advanced multi-level cache architectures.",
      "image": ""
    },
    {
      "slideNumber": 12,
      "title": "Cache coherence",
      "kicker": "Slide 12",
      "body": [
        "Cache stores copy of main memory data",
        "If one copy is updated, coherence problem arises",
        "Two different versions of same data exist"
      ],
      "note": "Detailed explanation of coherence challenges.",
      "image": ""
    },
    {
      "slideNumber": 13,
      "title": "Multi-level caches",
      "kicker": "Slide 13",
      "body": [
        "Inclusive: L2 holds copy of L1 data plus discarded items",
        "Hit in L2 – data copied into L1",
        "Exclusive: L2 only holds data not in L1"
      ],
      "note": "Inclusive vs exclusive cache hierarchies.",
      "image": ""
    },
    {
      "slideNumber": 14,
      "title": "Write-through",
      "kicker": "Slide 14",
      "body": [
        "Data write updates cache AND main memory simultaneously",
        "Cache is always coherent with main memory",
        "Main memory write cycle is performed on every write",
        "Simple but can be slower due to memory latency"
      ],
      "note": "Write-through cache policy characteristics.",
      "image": ""
    },
    {
      "slideNumber": 15,
      "title": "Write-back",
      "kicker": "Slide 15",
      "body": [
        "Data write only updates the cache initially",
        "Cache and main memory become incoherent after write",
        "Modified data copied to main memory only when about to be overwritten",
        "More complex but reduces memory traffic"
      ],
      "note": "Write-back cache policy characteristics.",
      "image": ""
    },
    {
      "slideNumber": 16,
      "title": "External coherence",
      "kicker": "Slide 16",
      "body": [
        "Single processor cache coherence is not enough for multi-CPU systems",
        "Need protocols for multi-processor coherence",
        "MESI protocol used in Pentium and other Intel CPUs",
        "Processors must monitor bus for other processors' memory accesses"
      ],
      "note": "Coherence in multi-processor systems.",
      "image": ""
    },
    {
      "slideNumber": 17,
      "title": "MESI protocol",
      "kicker": "Slide 17",
      "body": [
        "Stores two bits per cache way indicating state:",
        "Modified - newer than main memory, must be written back",
        "Exclusive - clean, only this cache has it",
        "Shared - clean, other caches may have it",
        "Invalid - data not present or stale"
      ],
      "note": "MESI cache coherence protocol states.",
      "image": ""
    },
    {
      "slideNumber": 18,
      "title": "Caches in Intel Processors",
      "kicker": "Slide 18",
      "body": [
        "Evolution of cache design in Intel processors",
        "Similar evolution in other manufacturers",
        "Details not required to memorize"
      ],
      "note": "Historical perspective on cache implementation.",
      "image": ""
    },
    {
      "slideNumber": 19,
      "title": "The Pentium Cache",
      "kicker": "Slide 19",
      "body": [
        "Two on-chip caches: data cache and instruction cache",
        "Each: 2-way set-associative, 128 sets, 32-byte way size",
        "Byte-addressable data items",
        "Total cache size = 2 × 8KB = 16KB"
      ],
      "note": "Pentium processor cache specifications.",
      "image": ""
    },
    {
      "slideNumber": 20,
      "title": "The Pentium Cache",
      "kicker": "Slide 20",
      "body": [
        "Write-back by default, configurable to write-through",
        "Least-recently used (LRU) replacement algorithm",
        "Single LRU bit per set tracks usage"
      ],
      "note": "Pentium cache configuration options.",
      "image": ""
    },
    {
      "slideNumber": 21,
      "title": "Caching History",
      "kicker": "Slide 21",
      "body": [
        "80386 and earlier: no internal cache",
        "80486: 8KB L1 (unified)",
        "Pentium: 2 × 8KB L1 (split)",
        "Increasing cache sizes and levels over generations"
      ],
      "note": "Historical development of CPU caches.",
      "image": ""
    },
    {
      "slideNumber": 22,
      "title": "Caching History",
      "kicker": "Slide 22",
      "body": [
        "Later processors vary cache size by model",
        "Example: Core i5 650 (2 core)",
        "2 × 32KB L1, 256KB L2 per core, plus 4MB L3 shared",
        "Cache size distinguishes CPU models"
      ],
      "note": "Modern processor cache configurations.",
      "image": ""
    },
    {
      "slideNumber": 23,
      "title": "Pentium III Cache",
      "kicker": "Slide 23",
      "body": [
        "Advanced cache architecture for its time",
        "Larger cache sizes than previous generations",
        "Improved coherence protocols"
      ],
      "note": "Pentium III cache improvements.",
      "image": ""
    },
    {
      "slideNumber": 24,
      "title": "Your Cache",
      "kicker": "Slide 24",
      "body": [
        "Understanding your system's cache characteristics",
        "Important for performance optimization"
      ],
      "note": "Practical considerations for developers.",
      "image": ""
    },
    {
      "slideNumber": 25,
      "title": "Cache Definition",
      "kicker": "Slide 25",
      "body": [
        "Small storage area close to processing unit",
        "Stores recently-used data from larger, slower memory",
        "Transparent to software - functions automatically",
        "Improves effective memory access time"
      ],
      "note": "Formal definition of cache memory.",
      "image": ""
    },
    {
      "slideNumber": 26,
      "title": "BUT REMEMBER …",
      "kicker": "Slide 26",
      "body": [
        "Cache does not speed up CPU calculations",
        "Cache does not speed up the memory itself",
        "Cache reduces effective memory access time by exploiting locality"
      ],
      "note": "Important limitations and clarifications about cache benefits.",
      "image": ""
    },
    {
      "slideNumber": 27,
      "title": "Summary",
      "kicker": "Slide 27",
      "body": [
        "Cache mapping - how data is copied",
        "Cache updating strategies - maintaining consistency",
        "Multi-level caches - hierarchy for performance",
        "Coherence protocols - multi-processor consistency"
      ],
      "note": "Key concepts covered in the presentation.",
      "image": ""
    },
    {
      "slideNumber": 28,
      "title": "dii.csu.edu.cn",
      "kicker": "Slide 28",
      "body": [
        "Thank you",
        "Questions?"
      ],
      "note": "Conclusion and reference to department website.",
      "image": ""
    }
  ]
};
