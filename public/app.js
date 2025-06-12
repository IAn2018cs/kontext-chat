const starterImages = [
  {
    imageUrl: 'https://replicate.delivery/pbxt/N55l5TWGh8mSlNzW8usReoaNhGbFwvLeZR3TX1NL4pd2Wtfv/replicate-prediction-f2d25rg6gnrma0cq257vdw2n4c.png',
    suggestedPrompt: '把它变成90年代的卡通风格',
  },
  {
    imageUrl: 'https://replicate.delivery/pbxt/N5cepICxyaagdvULl0phi7ImdxuFz05TR2l623zqxhNR9q5Y/van-gogh.jpeg',
    suggestedPrompt: '用这种风格画一只熊猫宇航员骑着独角兽',
  },
  {
    imageUrl: 'https://replicate.delivery/xezq/OKWfR6jlQwzekkSsfQOppX55O3vaNv6xZ4qY6RfHjwQHOwDTB/tmp9p3v3brc.png',
    suggestedPrompt: '移除运动衫上的文字',
  },
  {
    imageUrl: 'https://replicate.delivery/pbxt/N5trWTJCJQbJVWz5nhLEscS1w16r1hGl5zuWceJhVSnWZfGu/mona-lisa-1024.jpg',
    suggestedPrompt: '让她闭上眼睛',
  },
	{
    imageUrl: 'https://replicate.delivery/mgxm/b033ff07-1d2e-4768-a137-6c16b5ed4bed/d_1.png',
    suggestedPrompt: '转换为高质量的修复图，增强细节并移除任何损坏或退化',
  }
]

function App() {
  // State for upload vs chat mode
  const [showUpload, setShowUpload] = React.useState(true);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  // No need for separate image state - just use what's in the chat!
  const [predictionId, setPredictionId] = React.useState(null);
  const [abortController, setAbortController] = React.useState(null);
  // New: track if a starter image was used (for future logic if needed)
  const [starterUsed, setStarterUsed] = React.useState(false);
  // New: model selection state
  const [availableModels, setAvailableModels] = React.useState([]);
  const [selectedModel, setSelectedModel] = React.useState('');
  const [modelsLoading, setModelsLoading] = React.useState(false);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  // Simple desktop check
  const [isDesktop, setIsDesktop] = React.useState(false);
  
  // Toggle theme function
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };
  
  // Initialize theme from localStorage
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    // 默认使用暗色主题，除非用户明确保存了亮色主题设置
    const shouldBeDark = savedTheme === 'light' ? false : true;
    
    setIsDarkMode(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);
  
  // Save theme to localStorage
  React.useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  React.useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Load available models on component mount
  React.useEffect(() => {
    const loadModels = async () => {
      setModelsLoading(true);
      try {
        const response = await fetch('/models');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models || []);
          // Set first model as default if available
          if (data.models && data.models.length > 0) {
            setSelectedModel(data.models[0].value);
          }
        } else {
          console.error('Failed to load models');
        }
      } catch (error) {
        console.error('Error loading models:', error);
      } finally {
        setModelsLoading(false);
      }
    };
    loadModels();
  }, []);

  // Ref for chat container and file input
  const chatContainerRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }, 50);
    }
  }, [messages]);

  // Lock body scrolling on mobile for a consistent experience across screens
  React.useEffect(() => {
    if (!isDesktop) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isDesktop]);

  // Drag and drop state
  const [dragActive, setDragActive] = React.useState(false);

  // Helper to scroll to bottom (for image onLoad)
  function scrollToBottom() {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }, 50);
    }
  }

  // Drag and drop handlers for upload area
  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0] && files[0].type.startsWith('image/')) {
      handleFile(files[0]);
    }
  }

  // Handle file selection
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  }

  // Process uploaded file
  async function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('请选择有效的图片文件。');
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('图片文件过大。请选择小于10MB的图片。');
      return;
    }

    try {
      // Scale down the image to 1 megapixel
      const scaledBlob = await scaleImageTo1Megapixel(file);
      const url = URL.createObjectURL(scaledBlob);

      // Add initial messages
      setMessages([
        { type: 'image', image: url, imageBlob: scaledBlob, from: 'assistant', id: Date.now() },
        { type: 'text', text: '图片上传成功！你想怎么编辑它？', from: 'system', id: Date.now() + 1 }
      ]);

      // Switch to chat mode
      setShowUpload(false);
    } catch (error) {
      alert('处理图片失败：' + error.message);
    }
  }

  // Handle click on starter image
  async function handleStarterImageClick(starter) {
    // Fetch the image as a blob so it behaves like uploaded images
    try {
      setLoading(true);
      const res = await fetch(starter.imageUrl);
      const blob = await res.blob();
      // Add image as first message
      setMessages([
        { type: 'image', image: starter.imageUrl, imageBlob: blob, from: 'assistant', id: Date.now() },
        { type: 'text', text: "图片加载成功！告诉我你想怎么编辑它。", from: 'system', id: Date.now() + 1 }
      ]);
      setShowUpload(false);
      setInput(starter.suggestedPrompt || '');
      setStarterUsed(true);
    } catch (err) {
      alert('加载初始图片失败。');
    } finally {
      setLoading(false);
    }
  }

  // Helper function to convert blob to data URL
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Get the most recent image from the chat
  function getLastImageBlob() {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'image' && messages[i].imageBlob) {
        return messages[i].imageBlob;
      }
    }
    return null;
  }

  // Scale image function
  async function scaleImageTo1Megapixel(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        const originalWidth = img.width;
        const originalHeight = img.height;
        const originalPixels = originalWidth * originalHeight;
        const targetPixels = 1000000;

        let newWidth, newHeight;

        if (originalPixels <= targetPixels) {
          newWidth = originalWidth;
          newHeight = originalHeight;
        } else {
          const scaleFactor = Math.sqrt(targetPixels / originalPixels);
          newWidth = Math.round(originalWidth * scaleFactor);
          newHeight = Math.round(originalHeight * scaleFactor);
        }

        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('创建缩放图片失败'));
          }
        }, 'image/jpeg', 0.9);
      };

      img.onerror = () => {
        reject(new Error('加载图片失败'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  // Reset to upload mode
  function resetApp() {
    if (abortController) {
      abortController.abort();
    }
    setShowUpload(true);
    setMessages([]);
    setInput('');
    setPredictionId(null);
    setAbortController(null);
    setLoading(false);
    setStarterUsed(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Handle sending a message
  const handleSend = async (e) => {
    e.preventDefault();
    const lastImageBlob = getLastImageBlob();
    if (!input.trim() || loading || !lastImageBlob) return;

    const userMsg = { type: 'text', text: input, from: 'user', id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Add loading message
    const loadingMsg = { type: 'loading', from: 'assistant', id: Date.now() + 1 };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      // Create abort controller for this request
      const controller = new AbortController();
      setAbortController(controller);

      // Convert blob to data URL for the API
      console.log('将 blob 转换为 data URL...');
      const imageDataUrl = await blobToDataUrl(lastImageBlob);
      console.log('图片 data URL 长度:', imageDataUrl.length);

      console.log('发送请求到 /generate-image...');
      const requestBody = {
        prompt: input,
        input_image: imageDataUrl,
        model: selectedModel // Include selected model
      };
      console.log('请求体大小:', JSON.stringify(requestBody).length);
      console.log('使用模型:', selectedModel);

      const res = await fetch('/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error response body:', errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      // The response is now JSON with the Cloudflare Images URL
      const result = await res.json();
      console.log('Response result:', result);

      if (result.error) {
        throw new Error(result.error);
      }

      const imageUrl = result.imageUrl;
      console.log('Cloudflare Images URL:', imageUrl);

      // Fetch the image to create a blob for local storage/UI purposes
      // MODIFIED: Use a proxy endpoint to fetch the image
      const proxyUrl = `/fetch-image?url=${encodeURIComponent(imageUrl)}`;
      const imageResponse = await fetch(proxyUrl);
      const imageBlob = await imageResponse.blob();
      console.log('Image blob size:', imageBlob.size);

      // Replace loading with image (store blob in message)
      setMessages(prev => prev.map(msg =>
        msg.type === 'loading' ?
          { type: 'image', image: imageUrl, imageBlob: imageBlob, from: 'assistant', id: msg.id } :
          msg
      ));

      // Add delete button to user message
      setMessages(prev => prev.map(msg =>
        msg.id === userMsg.id ? { ...msg, showDelete: true } : msg
      ));

    } catch (err) {
      // Don't show error if request was aborted (cancelled)
      if (err.name !== 'AbortError') {
        setMessages(prev => prev.filter(msg => msg.type !== 'loading'));
        setMessages(prev => [...prev, {
          type: 'text',
          text: '抱歉，生成图片时出错：' + err.message,
          from: 'assistant',
          id: Date.now()
        }]);
      } else {
        console.log('请求已取消');
        setMessages(prev => prev.filter(msg => msg.type !== 'loading'));
      }
    } finally {
      setLoading(false);
      setPredictionId(null);
      setAbortController(null);
    }
  };

  // Cancel generation
  function cancelGeneration() {
    console.log('取消生成已调用');

    // Abort the ongoing request
    if (abortController) {
      console.log('正在中止请求...');
      abortController.abort();
      setAbortController(null);
    }

    // Stop loading
    setLoading(false);
    setPredictionId(null);

    // Find the most recent user message to restore to input
    const currentMessages = [...messages];
    const lastUserMessage = currentMessages.slice().reverse().find(msg => msg.from === 'user' && msg.type === 'text');
    console.log('Last user message:', lastUserMessage);

    // Remove loading message and the most recent user message
    // This automatically makes the previous image the "last image" again
    setMessages(prev => {
      const filtered = prev.filter(msg =>
        msg.type !== 'loading' &&
        !(lastUserMessage && msg.from === 'user' && msg.type === 'text' && msg.id === lastUserMessage.id)
      );
      console.log('Messages after cancel:', filtered.length);
      return filtered;
    });

    // Restore the cancelled message to input
    if (lastUserMessage) {
      setTimeout(() => {
        console.log('将文本恢复到输入框:', lastUserMessage.text);
        setInput(lastUserMessage.text);
      }, 50);
    }
  }

  // Delete message and all subsequent messages
  function deleteFromMessage(messageId) {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    // Keep messages up to the clicked message (excluding it)
    const remainingMessages = messages.slice(0, messageIndex);
    setMessages(remainingMessages);

    // No need to set current image - getLastImageBlob will find it automatically
  }

  // No longer needed - state is derived from chat messages

  // Handle image click for full screen
  function handleImageClick(imageUrl) {
    console.log('图片点击事件触发，URL:', imageUrl);
    if (imageUrl) {
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
    } else {
      console.error('图片URL为空');
    }
  }

  // Attach drag events when in upload mode
  React.useEffect(() => {
    if (showUpload) {
      window.addEventListener('dragenter', handleDrag);
      window.addEventListener('dragover', handleDrag);
      window.addEventListener('dragleave', handleDrag);
      window.addEventListener('drop', handleDrop);
      return () => {
        window.removeEventListener('dragenter', handleDrag);
        window.removeEventListener('dragover', handleDrag);
        window.removeEventListener('dragleave', handleDrag);
        window.removeEventListener('drop', handleDrop);
      };
    }
  }, [showUpload]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e04f0c] via-[#f47020] to-[#ff8c42] md:overflow-auto overflow-hidden relative dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="theme-toggle"
        title={isDarkMode ? '切换到亮色主题' : '切换到暗色主题'}
      >
        {isDarkMode ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
          </svg>
        )}
      </button>
      
      {/* Floating background elements for modern effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl floating-animation dark:bg-gray-400/5"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-300/10 rounded-full blur-3xl floating-animation dark:bg-blue-400/5" style={{animationDelay: '2s'}}></div>
      </div>
      
      {/* Main Content */}
      <div className="min-h-screen flex flex-col md:flex md:items-center h-screen md:min-h-screen relative z-10 md:py-4">
        {showUpload ? (
          /* Upload Section */
          <div className="w-full md:w-4/5 upload-card md:rounded-3xl flex flex-col h-screen md:h-auto overflow-hidden md:overflow-visible md:my-8">
            {/* Logo */}
            <div className="p-6 md:p-4 bg-gradient-to-r from-white to-gray-50 border-b border-gray-100 md:rounded-t-3xl fade-in">
              <h1 className="app-title floating-animation">Amber Kontext Chat</h1>
            </div>

            {/* Upload Area */}
            <div className="flex-1 flex flex-col p-6 md:p-8 overflow-y-auto md:overflow-visible pb-32 md:pb-8 fade-in" style={{paddingBottom: 'calc(8rem + env(safe-area-inset-bottom))', animationDelay: '0.1s'}}>
              {/* Intro Text */}
              <div className="text-center mb-8 fade-in" style={{animationDelay: '0.2s'}}>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-3">
                  AI 图片编辑器
                </h1>
                <p className="text-gray-600 text-lg md:text-xl font-medium">
                  通过聊天编辑图片，让AI帮你实现创意想法
                </p>
              </div>

              {/* Model Selection */}
              <div className="mb-8 fade-in" style={{animationDelay: '0.3s'}}>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  选择AI模型
                </label>
                {modelsLoading ? (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 text-center text-gray-500 border border-gray-200 pulse-glow">
                    <div className="inline-block w-5 h-5 border-2 border-gray-400 border-t-orange-500 rounded-full animate-spin mr-2"></div>
                    加载模型中...
                  </div>
                ) : (
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white text-gray-900 font-medium transition-all duration-200 hover:border-orange-300 hover:shadow-lg"
                  >
                    {availableModels.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div
                className={`border-2 border-dashed rounded-3xl p-8 md:p-16 text-center cursor-pointer mb-12 transition-all duration-300 fade-in ${
                  dragActive
                    ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 text-green-700 glow-effect pulse-glow'
                    : 'border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50 hover:border-orange-400 hover:bg-gradient-to-br hover:from-orange-50 hover:to-red-50 text-gray-700 hover:text-orange-700 hover:glow-effect hover:shadow-2xl'
                }`}
                onClick={() => fileInputRef.current?.click()}
                style={{animationDelay: '0.4s'}}
              >
                <div className="upload-content">
                  <div className="relative">
                    <svg className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 opacity-70 transition-transform duration-300 hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    <div className="absolute -inset-2 bg-gradient-to-r from-orange-400 to-red-400 rounded-full blur opacity-20 animate-pulse"></div>
                  </div>
                  <h3 className="text-xl md:text-2xl mb-2 md:mb-3 font-bold">上传图片开始创作</h3>
                  <p className="text-lg md:text-xl opacity-80 font-medium">将图片拖放到此处，或点击浏览文件</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </div>

              {/* Starter Images Section */}
              <div className="text-center text-gray-700 text-lg mb-6 font-semibold fade-in" style={{animationDelay: '0.5s'}}>✨ 或选择一张精美的示例图片开始：</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 fade-in" style={{animationDelay: '0.6s'}}>
                {starterImages.map((starter, idx) => (
                  <button
                    key={idx}
                    className="aspect-square w-full rounded-2xl overflow-hidden border-2 border-gray-200 hover:border-orange-400 focus:border-orange-500 transition-all duration-300 shadow-lg hover:shadow-2xl bg-gray-50 group relative transform hover:-translate-y-2"
                    onClick={() => handleStarterImageClick(starter)}
                    disabled={loading}
                    title={starter.suggestedPrompt}
                    style={{animationDelay: `${0.7 + idx * 0.1}s`}}
                  >
                    <img
                      src={starter.imageUrl}
                      alt={starter.suggestedPrompt}
                      className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 truncate backdrop-blur-sm bg-black/30 rounded px-2 py-1">
                      {starter.suggestedPrompt}
                    </div>
                  </button>
                ))}
              </div>

              
            </div>
          </div>
        ) : (
          /* Chat Section */
          <div className="w-full chat-fullscreen flex flex-col h-screen overflow-hidden relative fade-in">
            {/* Chat Header with Logo */}
            <div className="p-6 md:desktop-input-padding bg-gradient-to-r from-white to-gray-50 border-b border-gray-100 relative flex items-center flex-shrink-0 fade-in">
              <button
                onClick={resetApp}
                className="absolute left-6 md:left-12 w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg hover:shadow-xl"
                title="返回上传"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
              </button>
              <h1 
                className="app-title floating-animation cursor-pointer hover:opacity-90 transition-all duration-200 hover:scale-105 flex-1" 
                onClick={resetApp}
                title="返回上传"
                style={{fontSize: '1.5rem'}}
              >
                Amber Kontext Chat
              </h1>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 md:desktop-chat-padding space-y-6 pb-56 md:pb-8" ref={chatContainerRef}>
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'} fade-in`}
                  style={{animationDelay: `${index * 0.1}s`}}
                >
                  <div
                    className={`relative max-w-sm md:max-w-4xl transition-all duration-300 hover:scale-[1.02] ${
                      msg.from === 'user'
                        ? 'bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 text-white rounded-3xl px-5 py-4 shadow-lg hover:shadow-xl'
                        : msg.from === 'system'
                        ? 'bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-800 rounded-2xl px-5 py-4 italic border border-blue-200 shadow-sm hover:shadow-lg'
                        : 'glass-effect text-gray-800 rounded-2xl rounded-bl-md px-5 py-4 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {msg.type === 'image' && (
                      <div className="relative group cursor-pointer" onClick={() => handleImageClick(msg.image)}>
                        <img
                          src={msg.image}
                          alt="生成的图片"
                          className="max-w-xs md:max-w-2xl rounded-xl hover:opacity-95 transition-all duration-300 shadow-lg group-hover:shadow-xl"
                          onLoad={scrollToBottom}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-all duration-300 flex items-center justify-center pointer-events-none">
                          <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                        </div>
                      </div>
                    )}
                    {msg.type === 'loading' && (
                      <div className="flex flex-col items-center gap-6 py-10 px-16">
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-r-red-400 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
                        </div>
                        <div className="text-center">
                          <span className="text-gray-700 font-medium text-lg">正在生成图片...</span>
                          <div className="text-gray-500 text-sm mt-1">请稍候，AI正在为您创作</div>
                        </div>
                      </div>
                    )}
                    {msg.text && <div className="text-base md:text-lg leading-relaxed">{msg.text}</div>}

                    {/* Delete button for user messages */}
                    {msg.showDelete && (
                      <button
                        onClick={() => deleteFromMessage(msg.id)}
                        className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg hover:shadow-xl"
                        title="从此处删除并继续编辑"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 glass-effect border-t border-gray-200 p-6 md:desktop-input-padding md:relative md:border-t fade-in" style={{paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', animationDelay: '0.3s'}}>
              {/* Model Selection in Chat Mode */}
              <div className="mb-4 max-w-none mx-auto">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white text-gray-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:border-orange-300 hover:shadow-lg"
                >
                  {availableModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <form onSubmit={handleSend} className="flex items-end gap-4 max-w-none mx-auto">
                <div className="flex-1 relative">
                  <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-3xl px-5 py-4 pr-14 border-2 border-gray-200 focus-within:border-orange-500 focus-within:bg-white transition-all duration-200 hover:border-orange-300 shadow-sm focus-within:shadow-lg hover:shadow-lg">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="✨ 描述你想要的编辑效果..."
                      className="w-full bg-transparent border-none outline-none resize-none text-base placeholder-gray-500 font-medium"
                      rows="1"
                      style={{ minHeight: '24px', maxHeight: '120px' }}
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!loading && input.trim()) {
                            handleSend(e);
                          }
                        }
                      }}
                    />

                    {/* Send/Cancel Button */}
                    {loading ? (
                      <button
                        type="button"
                        onClick={cancelGeneration}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 pulse-glow"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-full flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100 disabled:hover:shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
