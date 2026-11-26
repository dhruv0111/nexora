import {
  Braces,
  Layers3,
  Check,
  GitPullRequest,
  Sparkles,
  Search,
  SlidersHorizontal,
  Code2,
  ShieldCheck,
  Cpu,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';
export function ProjectShowcase() {
  return (
    <div className="hireflow-window" data-cinema-reveal>
      <div className="window-bar">
        <div className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span>HireFlow / Product workspace</span>
        <span className="demo-label">Illustrative learning project</span>
      </div>
      <div className="hireflow-app">
        <aside className="hireflow-sidebar" aria-hidden="true">
          <span className="hireflow-mark">
            <Layers3 size={20} />
            hireflow
          </span>
          <span className="hf-active">
            <Braces size={15} />
            Sprint board
          </span>
          <span>
            <GitPullRequest size={15} />
            Contributions
          </span>
          <span>
            <Sparkles size={15} />
            AI experiments
          </span>
          <span>
            <ChartNoAxesColumnIncreasing size={15} />
            Insights
          </span>
          <div className="hf-pod">
            <span>ONE PRODUCT. FOUR DISCIPLINES.</span>
            <div className="pod-avatars">
              {['DEV', 'QA', 'AI', 'DA'].map((x) => (
                <i key={x}>{x}</i>
              ))}
            </div>
            <p>A shared space to build together.</p>
          </div>
        </aside>
        <div className="hireflow-board">
          <div className="board-heading">
            <div>
              <p className="eyebrow">LEARNING SPRINT · DEMO</p>
              <h3>Small commits. Real progress.</h3>
            </div>
            <div className="board-tools" aria-hidden="true">
              <Search size={16} />
              <SlidersHorizontal size={16} />
            </div>
          </div>
          <p className="board-description">
            Build a thoughtful hiring workflow, one contribution at a time.
          </p>
          <div className="sprint-columns">
            <div>
              <h4>
                <span className="column-dot" />
                In progress <span>2</span>
              </h4>
              <div className="sprint-task">
                <span className="task-tag task-violet">
                  <Code2 size={12} />
                  DEVELOPMENT
                </span>
                <h5>Build opportunity filters</h5>
                <p>Connect the search interface to a typed API.</p>
                <div className="task-footer">
                  <span>HF-024</span>
                  <code>React · API</code>
                </div>
              </div>
              <div className="sprint-task">
                <span className="task-tag task-pink">
                  <Cpu size={12} />
                  AI ENGINEERING
                </span>
                <h5>Evaluate matching hints</h5>
                <p>Compare relevance with a small evaluation set.</p>
                <div className="task-footer">
                  <span>HF-031</span>
                  <code>Python · LLMs</code>
                </div>
              </div>
            </div>
            <div>
              <h4>
                <span className="column-dot green" />
                In review <span>2</span>
              </h4>
              <div className="sprint-task">
                <span className="task-tag task-coral">
                  <ShieldCheck size={12} />
                  QUALITY ENGINEERING
                </span>
                <h5>Verify the application flow</h5>
                <p>Add automated checks for the happy path.</p>
                <div className="task-footer">
                  <span>HF-028</span>
                  <code>Playwright</code>
                </div>
              </div>
              <div className="sprint-task">
                <span className="task-tag task-blue">
                  <ChartNoAxesColumnIncreasing size={12} />
                  DATA ANALYTICS
                </span>
                <h5>Understand the funnel</h5>
                <p>Turn sample application events into insights.</p>
                <div className="task-footer">
                  <span>HF-035</span>
                  <code>SQL · Metrics</code>
                </div>
              </div>
            </div>
          </div>
          <div className="board-review">
            <Check size={14} />
            <span>
              Every contribution is a learning opportunity. Mentor review comes
              first.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
